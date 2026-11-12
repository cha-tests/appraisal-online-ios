-- Personal-data export ("Export Data" in consumer/settings.tsx and
-- broker/settings.tsx, which until now only showed "Coming Soon").
-- Backend only: one RPC, export_my_data(), returning a single structured
-- jsonb bundle of everything the CALLING user owns. Turning that into a
-- downloadable file is the client's job.
--
-- Scope rule: the export never shows a user more about anyone else than
-- the app already shows them. Concretely, every cross-user piece is read
-- THROUGH the existing masking functions rather than re-derived here:
--
--   - A broker's routed leads come from get_my_lead_routings() (037/038),
--     which only fills in the homeowner's name/email/phone/exact address
--     (and the claim-gated report fields) on rows the broker has actually
--     claimed. An invited-but-unclaimed row stays masked in the export
--     exactly as it is in the Lead Inbox. If that function's rule ever
--     changes, this export follows it automatically. There is no second
--     copy of the rule to drift.
--   - A consumer's routed brokers come from get_my_connected_brokers()
--     (039), i.e. the same public listing info (company/own name, status)
--     consumer/settings.tsx's Broker Contact section already shows.
--
-- Everything else is the caller's own rows only, each filtered on
-- auth.uid() explicitly (SECURITY DEFINER bypasses RLS, so the WHERE
-- clauses below ARE the access boundary for those tables).
--
-- Deliberately NOT included (see the PR/hand-off notes, flagged for a
-- human decision):
--   - broker_contact_revocations rows that name the caller as the BROKER.
--     No RLS policy lets a broker read these today (only the consumer who
--     wrote them, and admins); the broker already sees the outcome
--     (status = 'revoked') via get_my_lead_routings(). The homeowner's
--     reason/free-text note stays out until someone decides otherwise.
--   - notification_queue rows. Server-side outbox with no client access
--     at all; its payloads are copies of data already exported elsewhere.
--
-- Four more flagged-for-human-decision points this migration's own review
-- surfaced, kept here (not just in chat) so they aren't lost before merge:
--   - reports.gemini_response (001, "Full API response for audit") is
--     included verbatim in a consumer's own report export via the plain
--     to_jsonb(r) wildcard copy below. It can be large and exposes raw
--     model output. Decide whether to keep it or strip it before export.
--   - A broker who already CLAIMED a lead keeps seeing the homeowner's
--     contact details after being revoked, here and in-app, because
--     revoke_broker_contact() (037) only flips lead_routings.status to
--     'revoked' -- claim_status (the actual PII gate) stays 'claimed'.
--     This matches the documented design (a revoke can't force a broker
--     who already has the number to stop contacting them), so it's
--     intentional, not a bug -- flagged here only so it's an explicit
--     sign-off, not an assumption.
--   - broker_profiles.referred_by is exported as a bare referrer user_id,
--     no name attached. There is also no "brokers I referred" reverse
--     list -- that would mean reading other users' own profile rows.
--
-- Separately (not an export-scope question, a real finding): consumer/
-- settings.tsx runs supabase.from('users').select('preferences') as live
-- code, but no migration from 001 through this one ever adds a
-- `preferences` column to `users`. Either production has it added outside
-- migration history, or that query is silently failing today. Worth its
-- own investigation outside this migration -- to_jsonb(u) below will
-- simply include whatever is actually there for the caller's own row,
-- correctly, regardless of how that's resolved.
--   - auth.users (credentials). public.users has no password column, but
--     the user row is still stripped of any password-ish key defensively
--     in case a column like that is ever added.

CREATE OR REPLACE FUNCTION export_my_data()
RETURNS JSONB AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_user JSONB;
  v_consumer JSONB;
  v_broker JSONB := NULL;
  v_profile JSONB;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT to_jsonb(u) - 'password_hash' - 'encrypted_password' - 'password'
  INTO v_user
  FROM users u
  WHERE u.id = v_uid;

  IF v_user IS NULL THEN
    RAISE EXCEPTION 'User record not found';
  END IF;

  -- ---------------------------------------------------------------------
  -- Consumer-side data. Always computed (empty arrays for a broker who
  -- never created a report) so the bundle has one stable shape.
  -- ---------------------------------------------------------------------
  v_consumer := jsonb_build_object(
    'properties', coalesce((
      SELECT jsonb_agg(to_jsonb(p) ORDER BY p.created_at)
      FROM properties p WHERE p.user_id = v_uid
    ), '[]'::jsonb),
    'reports', coalesce((
      SELECT jsonb_agg(to_jsonb(r) ORDER BY r.created_at)
      FROM reports r WHERE r.user_id = v_uid
    ), '[]'::jsonb),
    'leads', coalesce((
      SELECT jsonb_agg(to_jsonb(l) ORDER BY l.created_at)
      FROM leads l WHERE l.consumer_id = v_uid
    ), '[]'::jsonb),
    -- Which brokers each lead went to, and at what status: exactly the
    -- masked view the consumer already gets in-app.
    'connected_brokers', coalesce((
      SELECT jsonb_agg(to_jsonb(cb))
      FROM get_my_connected_brokers() cb
    ), '[]'::jsonb),
    -- The consumer's own revoke requests (they wrote these; RLS already
    -- lets them read them).
    'broker_contact_revocations', coalesce((
      SELECT jsonb_agg(to_jsonb(bcr) ORDER BY bcr.created_at)
      FROM broker_contact_revocations bcr WHERE bcr.consumer_id = v_uid
    ), '[]'::jsonb),
    'report_allowance', coalesce((
      SELECT jsonb_agg(to_jsonb(ra) ORDER BY ra.month)
      FROM report_allowance ra WHERE ra.user_id = v_uid
    ), '[]'::jsonb)
  );

  -- ---------------------------------------------------------------------
  -- Broker-side data, only when the caller has a broker profile.
  -- ---------------------------------------------------------------------
  SELECT to_jsonb(bp) INTO v_profile
  FROM broker_profiles bp WHERE bp.user_id = v_uid;

  IF v_profile IS NOT NULL THEN
    v_broker := jsonb_build_object(
      -- Includes referral_code / referred_by as stored (read-only;
      -- attribution only, no reward data exists or is derived here).
      'profile', v_profile,
      'selected_cities', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'id', c.id, 'name', c.name, 'state', c.state, 'country', c.country
        ) ORDER BY c.name)
        FROM broker_profiles bp
        JOIN cities c ON c.id = ANY(bp.selected_cities)
        WHERE bp.user_id = v_uid
      ), '[]'::jsonb),
      'subscriptions', coalesce((
        SELECT jsonb_agg(to_jsonb(s) ORDER BY s.created_at)
        FROM subscriptions s WHERE s.broker_id = v_uid
      ), '[]'::jsonb),
      'refunds', coalesce((
        SELECT jsonb_agg(to_jsonb(rl) ORDER BY rl.created_at)
        FROM refund_log rl WHERE rl.broker_id = v_uid
      ), '[]'::jsonb),
      -- The ONLY source of homeowner data in a broker's export. PII is
      -- non-null only on rows this broker has claimed (see header).
      'lead_routings', coalesce((
        SELECT jsonb_agg(to_jsonb(lr))
        FROM get_my_lead_routings() lr
      ), '[]'::jsonb)
    );
  END IF;

  RETURN jsonb_build_object(
    'export_version', 1,
    'generated_at', now(),
    'account_type', v_user->>'user_type',
    'user', v_user,
    'disclaimer_acceptances', coalesce((
      SELECT jsonb_agg(to_jsonb(da) ORDER BY da.accepted_at)
      FROM disclaimer_acceptances da WHERE da.user_id = v_uid
    ), '[]'::jsonb),
    'consumer', v_consumer,
    'broker', v_broker
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- Postgres grants EXECUTE to PUBLIC by default; this one is signed-in
-- users only (it also refuses a NULL auth.uid() itself).
REVOKE ALL ON FUNCTION export_my_data() FROM PUBLIC;
REVOKE ALL ON FUNCTION export_my_data() FROM anon;
GRANT EXECUTE ON FUNCTION export_my_data() TO authenticated;
