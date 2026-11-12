-- Real account deletion for both consumers and brokers. Replaces the fake
-- "Request Deletion" success alert in consumer/settings.tsx and
-- broker/settings.tsx (the confirm-step UI is wired separately on top of
-- this; this migration is only the database half).
--
-- Three parts, run by the backend in this order (see
-- backend/src/services/accountDeletion.service.ts):
--   1. delete_my_account() below — every database row, for the CALLING
--      user only (auth.uid(); there is no parameter, so there is no way to
--      aim it at anyone else).
--   2. Storage objects under <user_id>/ in kyc-documents, broker-photos
--      and property-documents — needs the service-role key (Supabase's
--      storage API), so it lives in the backend, not here.
--   3. The auth.users login itself — needs the Admin API, also backend.
--
-- ============================================================================
-- Design: hard-delete what only the deleting user can see; anonymize in
-- place what has audit/history value to the OTHER party.
-- ============================================================================
--
-- public.users is NOT deleted — it becomes a scrubbed tombstone (no name,
-- phone, or real email; deleted_at set, the column 001_initial_schema.sql
-- already had for exactly this). Reason: lead_routings.broker_id,
-- leads.consumer_id, subscriptions/refund_log.broker_id and
-- broker_contact_revocations.consumer_id are all NOT NULL FKs with
-- ON DELETE CASCADE — deleting the users row would silently cascade away
-- the very rows we decide below to keep for the other party. public.users
-- has no FK to auth.users, so the tombstone survives the auth deletion in
-- step 3, and its email is rewritten to a unique `.invalid` address so the
-- real address is immediately free for a fresh signup.
--
-- CONSUMER side:
--   - Every lead where NO broker ever claimed (nobody ever saw contact
--     info): the whole property is hard-deleted, cascading to its
--     reports, leads, lead_routings (invited brokers only ever saw a
--     masked preview), broker_contact_revocations and notification_queue.
--   - A lead where at least one broker CLAIMED (that broker has a real
--     pipeline entry and may already have spoken to the homeowner): the
--     property/report/lead rows are KEPT but every piece of homeowner PII
--     is scrubbed — address, Google Places components, phone, email,
--     Gemini raw response (can echo the address), PDF/title links — and
--     reports.broker_contact_opted_in is set FALSE so escalation
--     (escalate_all_pending_leads), orphan routing
--     (route_all_orphaned_leads) and consumer check-ins
--     (queue_consumer_check_ins) all stop touching it. The non-identifying
--     facts (property type, city, value range, condition, tags) stay, so
--     the broker's pipeline row and status history still make sense.
--     Any invited-but-unclaimed routings on that same lead are removed.
--   - broker_contact_revocations the consumer filed are kept (platform
--     revoke-rate-by-reason metrics) with the free-text reason_note
--     cleared; they point at the tombstone.
--   - report_allowance, disclaimer_acceptances: hard-deleted (only the
--     user ever sees them).
--
-- BROKER side:
--   - broker_profiles: hard-deleted (company name, license number, bio,
--     photo URL, phone, website, KYC file paths, referral code). This also
--     takes the broker out of every routing function, which all JOIN
--     broker_profiles.
--   - lead_routings where they were only INVITED: hard-deleted. Same as
--     revoke_broker_contact (037) does for an unclaimed row — they never
--     saw contact info, and dropping the row frees the slot so escalation
--     (or the orphan sweep, if it was the lead's only routing) re-invites
--     someone else for the homeowner.
--   - lead_routings they had CLAIMED: KEPT, anonymized in place — the row
--     still references the tombstone users row (so the homeowner's
--     "who I was connected to" list still shows that a professional was
--     connected, and its status/revocation audit trail survives), but
--     every identifying field behind it is gone. delivery_error is cleared.
--   - subscriptions: kept as a financial record, status set to
--     'cancelled' (cancelled_at = now()) if still active/pending.
--     refund_log: kept untouched (financial/refund-rate record). No Stripe
--     call is needed — broker payments are one-off annual PaymentIntents
--     (routes/payments.ts), not recurring Stripe subscriptions, so there
--     is nothing on Stripe's side that would charge again.
--   - Other brokers' broker_profiles.referred_by pointing at this broker:
--     left alone (attribution-only referral program, migration 030; it now
--     points at an anonymous tombstone).
--
-- BOTH: every notification_queue row addressed to the user is deleted, and
-- property_address is scrubbed out of any queued payload about a kept
-- (anonymized) consumer lead.
--
-- Idempotent: calling it again on an already-deleted account just re-runs
-- the same scrub (a no-op), so the backend can safely retry the whole
-- sequence if storage or auth deletion fails after this step succeeded.

CREATE OR REPLACE FUNCTION delete_my_account()
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_tombstone_email TEXT;
  v_properties_deleted INTEGER := 0;
  v_leads_anonymized INTEGER := 0;
  v_routings_deleted INTEGER := 0;
  v_routings_anonymized INTEGER := 0;
  v_broker_profile_deleted INTEGER := 0;
  v_subscriptions_cancelled INTEGER := 0;
  v_kept_lead_ids UUID[];
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM users WHERE id = v_user_id) THEN
    RAISE EXCEPTION 'User profile not found' USING ERRCODE = 'P0002';
  END IF;

  v_tombstone_email := 'deleted-' || v_user_id::text || '@deleted.invalid';

  -- Serialize against claim_lead() on any lead this user is party to, so a
  -- broker can't claim one of this consumer's leads in between the
  -- "was it ever claimed?" check and the delete below (claim_lead takes
  -- the same per-lead advisory lock).
  PERFORM pg_advisory_xact_lock(hashtext(l.id::text))
  FROM leads l
  WHERE l.consumer_id = v_user_id
  ORDER BY l.id;

  -- ==========================================================================
  -- Consumer side
  -- ==========================================================================

  -- Leads with at least one claimed routing (any status, incl. revoked)
  -- are kept and anonymized; everything else this user owns goes.
  SELECT coalesce(array_agg(DISTINCT l.id), '{}')
  INTO v_kept_lead_ids
  FROM leads l
  JOIN lead_routings lr ON lr.lead_id = l.id
  WHERE l.consumer_id = v_user_id
    AND lr.claim_status = 'claimed';

  -- Properties with no kept lead at all: delete outright (cascades to
  -- reports -> leads -> lead_routings -> notification_queue, and
  -- reports -> broker_contact_revocations).
  DELETE FROM properties p
  WHERE p.user_id = v_user_id
    AND NOT EXISTS (
      SELECT 1 FROM leads l
      WHERE l.property_id = p.id AND l.id = ANY(v_kept_lead_ids)
    );
  GET DIAGNOSTICS v_properties_deleted = ROW_COUNT;

  -- A surviving property can still carry other reports that never
  -- produced a kept lead (e.g. a re-appraisal) — those go too.
  DELETE FROM reports r
  WHERE r.user_id = v_user_id
    AND NOT EXISTS (
      SELECT 1 FROM leads l
      WHERE l.report_id = r.id AND l.id = ANY(v_kept_lead_ids)
    );

  -- On a kept lead, brokers who were only invited never saw anything;
  -- drop them (and their pending invite notifications, by cascade).
  DELETE FROM lead_routings
  WHERE lead_id = ANY(v_kept_lead_ids)
    AND claim_status = 'invited';

  UPDATE properties
  SET address = 'Address removed (homeowner deleted their account)',
      address_components = NULL
  WHERE user_id = v_user_id;

  UPDATE reports
  SET broker_contact_opted_in = FALSE,
      phone_provided = NULL,
      phone_verified = FALSE,
      gemini_response = NULL,
      pdf_url = NULL,
      title_url = NULL,
      title_submitted_at = NULL,
      status = 'deleted'
  WHERE user_id = v_user_id;

  UPDATE leads
  SET consumer_email = '',
      consumer_phone = NULL,
      property_address = 'Address removed (homeowner deleted their account)',
      updated_at = now()
  WHERE consumer_id = v_user_id;
  GET DIAGNOSTICS v_leads_anonymized = ROW_COUNT;

  UPDATE broker_contact_revocations
  SET reason_note = NULL
  WHERE consumer_id = v_user_id;

  -- Queued payloads about a kept lead (e.g. broker_stop_contact) carry the
  -- homeowner's address; strip it.
  UPDATE notification_queue
  SET payload = payload - 'property_address'
  WHERE lead_id = ANY(v_kept_lead_ids)
    AND payload ? 'property_address';

  DELETE FROM report_allowance WHERE user_id = v_user_id;

  -- ==========================================================================
  -- Broker side
  -- ==========================================================================

  DELETE FROM lead_routings
  WHERE broker_id = v_user_id
    AND claim_status = 'invited';
  GET DIAGNOSTICS v_routings_deleted = ROW_COUNT;

  UPDATE lead_routings
  SET delivery_error = NULL
  WHERE broker_id = v_user_id;
  GET DIAGNOSTICS v_routings_anonymized = ROW_COUNT;

  DELETE FROM broker_profiles WHERE user_id = v_user_id;
  GET DIAGNOSTICS v_broker_profile_deleted = ROW_COUNT;

  UPDATE subscriptions
  SET status = 'cancelled',
      cancelled_at = coalesce(cancelled_at, now())
  WHERE broker_id = v_user_id
    AND status IN ('active', 'pending');
  GET DIAGNOSTICS v_subscriptions_cancelled = ROW_COUNT;

  -- ==========================================================================
  -- Both
  -- ==========================================================================

  DELETE FROM notification_queue WHERE recipient_user_id = v_user_id;
  DELETE FROM disclaimer_acceptances WHERE user_id = v_user_id;

  UPDATE users
  SET email = v_tombstone_email,
      first_name = 'Deleted',
      last_name = 'User',
      suffix = NULL,
      phone = NULL,
      is_admin = FALSE,
      last_login_at = NULL,
      deleted_at = coalesce(deleted_at, now())
  WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'user_id', v_user_id,
    'properties_deleted', v_properties_deleted,
    'leads_anonymized', v_leads_anonymized,
    'lead_routings_deleted', v_routings_deleted,
    'lead_routings_anonymized', v_routings_anonymized,
    'broker_profile_deleted', v_broker_profile_deleted > 0,
    'subscriptions_cancelled', v_subscriptions_cancelled
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION delete_my_account() FROM PUBLIC;
REVOKE ALL ON FUNCTION delete_my_account() FROM anon;
GRANT EXECUTE ON FUNCTION delete_my_account() TO authenticated;
