-- Phase 1 (database foundation) of the claim-based lead routing redesign.
--
-- Today, routing picks up to `requested_broker_count` brokers and hands
-- every one of them the homeowner's full contact info immediately
-- ("Option A" — see CLAUDE.md's implementation notes on the original
-- Option A/B decision). This migration layers a consent gate on top of
-- that same routing: the same brokers are still chosen the same way, but
-- they see only a masked preview (property type, general area, price
-- range, condition, lead tags) until they actively tap "I want this
-- lead." Full contact info unlocks only for a broker who claims — closing
-- the gap where a homeowner's number was handed to a broker who was never
-- actually going to follow up.
--
-- If not enough of the originally-routed brokers claim, the pool widens on
-- its own: while literally nobody has claimed yet, check every 24h and add
-- 1 more broker; once at least one has claimed, check every 48h and add as
-- many new brokers as there are still-open slots. Nobody already invited
-- is ever removed — they can still claim at any point until every slot is
-- filled.
--
-- *** DO NOT APPLY THIS TO PRODUCTION YET. *** This drops leads.status and
-- moves it onto lead_routings (one status per broker, not one per lead —
-- needed since a lead can now be routed to several brokers who each make
-- independent progress). The live mobile app (lead-inbox.tsx,
-- lead-detail.tsx, consumer/settings.tsx) still reads/writes the old
-- columns directly — applying this now would break those screens for real
-- users. Hold off until Phase 2 (broker UI) and Phase 3 (consumer UI) also
-- ship. Tracked as a "Known gap" in CLAUDE.md.

-- ============================================================================
-- 1. Per-broker status replaces the old single leads.status.
--    New/Contacted/In Talks/Converted/Lost mirror what a broker sets
--    themselves; Revoked is set only by revoke_broker_contact() below, never
--    directly by a broker (enforced by the UPDATE policy's WITH CHECK).
-- ============================================================================

ALTER TABLE lead_routings
  ADD COLUMN status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'contacted', 'in_talks', 'converted', 'lost', 'revoked')),
  ADD COLUMN lost_reason TEXT,
  ADD COLUMN claim_status TEXT NOT NULL DEFAULT 'invited'
    CHECK (claim_status IN ('invited', 'claimed')),
  ADD COLUMN claimed_at TIMESTAMP WITH TIME ZONE;

-- leads.status is superseded by the per-broker column above. Nothing else
-- in this schema reads it once route_all_orphaned_leads/
-- route_orphaned_leads_to_broker are updated below to check
-- reports.broker_contact_opted_in instead (a more accurate signal anyway —
-- that's the actual "is this homeowner still open to contact" flag, which
-- leads.status='archived' was only ever a proxy for).
ALTER TABLE leads DROP COLUMN IF EXISTS status;

-- Superseded by the lead_routings UPDATE policy below (status moved off
-- this table entirely).
DROP POLICY IF EXISTS "Brokers can update assigned leads" ON leads;

CREATE POLICY "Brokers can update own lead routing status" ON lead_routings
  FOR UPDATE USING (auth.uid() = broker_id)
  WITH CHECK (
    auth.uid() = broker_id
    AND status IN ('new', 'contacted', 'in_talks', 'converted', 'lost')
  );

-- ============================================================================
-- 2. Masking: a broker only sees full contact info (the leads row itself,
--    and the properties/reports/users rows behind it) once they've
--    actually claimed — not merely because they were routed. The masked
--    preview for an invited-but-unclaimed row comes from
--    get_my_lead_routings() below instead, which is SECURITY DEFINER and
--    never selects the PII columns in the first place, so there's no code
--    path that can leak them pre-claim regardless of how a client queries.
-- ============================================================================

ALTER POLICY "Brokers can view assigned leads" ON leads
  USING (
    EXISTS (
      SELECT 1 FROM lead_routings
      WHERE lead_routings.lead_id = leads.id
        AND lead_routings.broker_id = auth.uid()
        AND lead_routings.claim_status = 'claimed'
    )
  );

ALTER POLICY "Brokers can view properties for assigned leads" ON properties
  USING (
    EXISTS (
      SELECT 1 FROM leads
      JOIN lead_routings ON lead_routings.lead_id = leads.id
      WHERE leads.property_id = properties.id
        AND lead_routings.broker_id = auth.uid()
        AND lead_routings.claim_status = 'claimed'
    )
  );

ALTER POLICY "Brokers can view reports for assigned leads" ON reports
  USING (
    EXISTS (
      SELECT 1 FROM leads
      JOIN lead_routings ON lead_routings.lead_id = leads.id
      WHERE leads.report_id = reports.id
        AND lead_routings.broker_id = auth.uid()
        AND lead_routings.claim_status = 'claimed'
    )
  );

ALTER POLICY "Brokers can view consumer info for assigned leads" ON users
  USING (
    EXISTS (
      SELECT 1 FROM leads
      JOIN lead_routings ON lead_routings.lead_id = leads.id
      WHERE leads.consumer_id = users.id
        AND lead_routings.broker_id = auth.uid()
        AND lead_routings.claim_status = 'claimed'
    )
  );

-- Single source of truth for the broker-side inbox/detail screens (Phase
-- 2) — one row per lead_routings entry for the calling broker, with the
-- PII columns computed as NULL unless that specific row is claimed. SQL
-- (not plpgsql) and SECURITY DEFINER so it can read across
-- properties/reports/users regardless of the tightened policies above,
-- while still only ever returning PII for a row the caller has actually
-- claimed.
CREATE OR REPLACE FUNCTION get_my_lead_routings()
RETURNS TABLE (
  lead_routing_id UUID,
  lead_id UUID,
  claim_status TEXT,
  status TEXT,
  lost_reason TEXT,
  delivery_channel TEXT,
  invited_at TIMESTAMP WITH TIME ZONE,
  claimed_at TIMESTAMP WITH TIME ZONE,
  property_type TEXT,
  condition TEXT,
  bedrooms INTEGER,
  bathrooms DECIMAL(3,1),
  city_name TEXT,
  city_state TEXT,
  estimated_value_low BIGINT,
  estimated_value_high BIGINT,
  lead_tags TEXT[],
  has_title_on_file BOOLEAN,
  property_address TEXT,
  consumer_name TEXT,
  consumer_email TEXT,
  consumer_phone TEXT,
  estimated_value BIGINT
) AS $$
  SELECT
    lr.id,
    lr.lead_id,
    lr.claim_status,
    lr.status,
    lr.lost_reason,
    lr.delivery_channel,
    lr.created_at,
    lr.claimed_at,
    p.property_type,
    p.condition,
    p.bedrooms,
    p.bathrooms,
    c.name,
    c.state,
    (rpt.confidence_range->>'low')::BIGINT,
    (rpt.confidence_range->>'high')::BIGINT,
    l.lead_tags,
    (rpt.title_url IS NOT NULL),
    CASE WHEN lr.claim_status = 'claimed' THEN l.property_address ELSE NULL END,
    CASE WHEN lr.claim_status = 'claimed' THEN trim(both ' ' from coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')) ELSE NULL END,
    CASE WHEN lr.claim_status = 'claimed' THEN l.consumer_email ELSE NULL END,
    CASE WHEN lr.claim_status = 'claimed' THEN l.consumer_phone ELSE NULL END,
    CASE WHEN lr.claim_status = 'claimed' THEN rpt.estimated_value ELSE NULL END
  FROM lead_routings lr
  JOIN leads l ON l.id = lr.lead_id
  LEFT JOIN properties p ON p.id = l.property_id
  LEFT JOIN cities c ON c.id = l.city_id
  LEFT JOIN reports rpt ON rpt.id = l.report_id
  LEFT JOIN users u ON u.id = l.consumer_id
  WHERE lr.broker_id = auth.uid()
  ORDER BY lr.created_at DESC;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION get_my_lead_routings() TO authenticated;

-- ============================================================================
-- 3. Claim and revoke.
-- ============================================================================

-- Unlocks full contact info for the caller's own lead_routings row. Not an
-- error to call on an already-claimed row, or one that's no longer
-- available because the lead's quota filled elsewhere — both are just a
-- no-op (returns false) so a double-tap or a late claim on a now-full lead
-- doesn't need special error handling in the UI.
--
-- Each invited broker has their own row rather than competing for a
-- shared pool of fewer slots than candidates (see the header comment —
-- that's what makes this simpler than a full claim-race), but escalation
-- can still leave MORE brokers invited than requested_broker_count at
-- once (the original batch stays eligible even after a later batch is
-- added). Without the quota check below, several of them claiming around
-- the same time could push a lead's claimed count past what the homeowner
-- actually asked for — confirmed by a local test before this fix existed.
-- pg_advisory_xact_lock serializes concurrent claims on the same lead so
-- the count check and the update can't race each other.
CREATE OR REPLACE FUNCTION claim_lead(p_lead_routing_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_broker_id UUID;
  v_lead_id UUID;
  v_requested_count INTEGER;
  v_claimed_count INTEGER;
BEGIN
  SELECT broker_id, lead_id INTO v_broker_id, v_lead_id FROM lead_routings WHERE id = p_lead_routing_id;

  IF v_broker_id IS NULL THEN
    RAISE EXCEPTION 'Lead routing not found';
  END IF;

  IF v_broker_id != auth.uid() THEN
    RAISE EXCEPTION 'Can only claim your own routed leads';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_lead_id::text));

  SELECT r.requested_broker_count INTO v_requested_count
  FROM leads l
  JOIN reports r ON r.id = l.report_id
  WHERE l.id = v_lead_id;

  SELECT count(*) INTO v_claimed_count
  FROM lead_routings
  WHERE lead_id = v_lead_id AND claim_status = 'claimed';

  IF v_requested_count IS NOT NULL AND v_claimed_count >= v_requested_count THEN
    RETURN FALSE;
  END IF;

  UPDATE lead_routings
  SET claim_status = 'claimed', claimed_at = now()
  WHERE id = p_lead_routing_id AND claim_status = 'invited';

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION claim_lead(UUID) TO authenticated;

-- A homeowner asking one specific broker to stop. Splits cleanly on
-- whether that broker had already claimed (and so already has real
-- contact info) at the moment of revoke:
--   - Not yet claimed: they never saw any contact info, so there's
--     nothing to revoke from their side — just drop the row entirely,
--     freeing that slot for escalation.
--   - Already claimed: keep the row (there's a real relationship worth a
--     record of), mark it 'revoked' so their inbox reflects it distinctly
--     from 'lost', and Phase 4's stop-contact notice has something to act
--     on. This can't force a broker who already has the homeowner's phone
--     number to stop contacting them — see CLAUDE.md on why that's a hard
--     limit of any marketplace that reveals contact info at all — but it's
--     a documented, timestamped request, backed by broker terms of
--     service (built in a later phase).
-- Either way, the reason is logged so support/product has real data on
-- why homeowners revoke, same spirit as the existing refund-rate tracking.
CREATE TABLE broker_contact_revocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  consumer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  broker_id UUID REFERENCES users(id) ON DELETE SET NULL,
  lead_routing_id UUID REFERENCES lead_routings(id) ON DELETE SET NULL,
  reason TEXT NOT NULL CHECK (reason IN (
    'decided_not_to_sell',
    'changed_mind',
    'not_satisfied_with_appraisal',
    'found_own_professional',
    'other'
  )),
  reason_note TEXT,
  had_claimed BOOLEAN NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE broker_contact_revocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Consumers can view own revocations" ON broker_contact_revocations
  FOR SELECT USING (auth.uid() = consumer_id);

CREATE POLICY "Admins can view all revocations" ON broker_contact_revocations
  FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.is_admin = TRUE));

-- No INSERT policy for `authenticated` — writes only ever happen through
-- revoke_broker_contact() below (SECURITY DEFINER), so there's one single,
-- auditable path that creates these rows.

CREATE OR REPLACE FUNCTION revoke_broker_contact(
  p_lead_routing_id UUID,
  p_reason TEXT,
  p_reason_note TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_consumer_id UUID;
  v_report_id UUID;
  v_broker_id UUID;
  v_claim_status TEXT;
BEGIN
  SELECT lr.broker_id, lr.claim_status, l.report_id, l.consumer_id
  INTO v_broker_id, v_claim_status, v_report_id, v_consumer_id
  FROM lead_routings lr
  JOIN leads l ON l.id = lr.lead_id
  WHERE lr.id = p_lead_routing_id;

  IF v_consumer_id IS NULL THEN
    RAISE EXCEPTION 'Lead routing not found';
  END IF;

  IF v_consumer_id != auth.uid() THEN
    RAISE EXCEPTION 'Can only revoke contact on your own leads';
  END IF;

  INSERT INTO broker_contact_revocations
    (report_id, consumer_id, broker_id, lead_routing_id, reason, reason_note, had_claimed)
  VALUES
    (v_report_id, v_consumer_id, v_broker_id, p_lead_routing_id, p_reason, p_reason_note, v_claim_status = 'claimed');

  IF v_claim_status = 'claimed' THEN
    UPDATE lead_routings SET status = 'revoked' WHERE id = p_lead_routing_id;
  ELSE
    DELETE FROM lead_routings WHERE id = p_lead_routing_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION revoke_broker_contact(UUID, TEXT, TEXT) TO authenticated;

-- ============================================================================
-- 4. Escalation — widens the invited pool on its own when not enough of
--    the originally-routed brokers claim. See the header comment above for
--    the exact 24h/48h rule; this is its direct implementation.
-- ============================================================================

CREATE OR REPLACE FUNCTION escalate_lead_routing(p_lead_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_city_id UUID;
  v_requested_count INTEGER;
  v_claimed_count INTEGER;
  v_needed INTEGER;
  v_last_invited_at TIMESTAMP WITH TIME ZONE;
  v_to_add INTEGER := 0;
  v_added INTEGER;
BEGIN
  SELECT l.city_id, r.requested_broker_count
  INTO v_city_id, v_requested_count
  FROM leads l
  JOIN reports r ON r.id = l.report_id
  WHERE l.id = p_lead_id;

  IF v_city_id IS NULL OR v_requested_count IS NULL THEN
    RETURN 0;
  END IF;

  -- Revoked rows are excluded entirely: that broker is no longer in the
  -- running (whether or not they'd claimed), so they count toward neither
  -- "claimed" nor "currently invited, awaiting a decision."
  SELECT
    count(*) FILTER (WHERE claim_status = 'claimed'),
    max(created_at)
  INTO v_claimed_count, v_last_invited_at
  FROM lead_routings
  WHERE lead_id = p_lead_id AND status != 'revoked';

  v_needed := v_requested_count - v_claimed_count;
  IF v_needed <= 0 THEN
    RETURN 0;
  END IF;

  IF v_claimed_count = 0 THEN
    -- Nobody has claimed anything yet: check every 24h, add exactly 1.
    IF v_last_invited_at IS NULL OR v_last_invited_at <= now() - INTERVAL '24 hours' THEN
      v_to_add := 1;
    END IF;
  ELSE
    -- At least one claim exists: check every 48h, add enough for every
    -- slot that's still open.
    IF v_last_invited_at IS NULL OR v_last_invited_at <= now() - INTERVAL '48 hours' THEN
      v_to_add := v_needed;
    END IF;
  END IF;

  IF v_to_add <= 0 THEN
    RETURN 0;
  END IF;

  INSERT INTO lead_routings (lead_id, broker_id, delivery_channel)
  SELECT
    p_lead_id,
    bp.user_id,
    CASE
      WHEN bp.email_enabled THEN 'email'
      WHEN bp.push_enabled THEN 'push'
      ELSE 'email'
    END
  FROM broker_profiles bp
  JOIN subscriptions s ON s.broker_id = bp.user_id AND s.status = 'active'
  WHERE bp.selected_cities @> ARRAY[v_city_id]
    AND bp.user_id NOT IN (SELECT broker_id FROM lead_routings WHERE lead_id = p_lead_id)
  ORDER BY s.started_at ASC
  LIMIT v_to_add;

  GET DIAGNOSTICS v_added = ROW_COUNT;
  RETURN v_added;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION escalate_lead_routing(UUID) TO authenticated;

-- Swept across every still-open lead. Correct but not maximally efficient
-- (loops over fully-filled leads too, which escalate_lead_routing then
-- immediately no-ops on) — fine at today's scale, same tradeoff
-- route_all_orphaned_leads below already makes.
CREATE OR REPLACE FUNCTION escalate_all_pending_leads()
RETURNS INTEGER AS $$
DECLARE
  v_lead_id UUID;
  v_total INTEGER := 0;
BEGIN
  FOR v_lead_id IN
    SELECT DISTINCT l.id
    FROM leads l
    JOIN reports r ON r.id = l.report_id
    WHERE r.broker_contact_opted_in = TRUE
      AND r.requested_broker_count IS NOT NULL
  LOOP
    v_total := v_total + escalate_lead_routing(v_lead_id);
  END LOOP;
  RETURN v_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION escalate_all_pending_leads() TO authenticated;

-- Hourly sweep — same pg_cron pattern as route-orphaned-leads-hourly
-- (migration 028). Hourly granularity is fine even for the 24h check: the
-- function itself compares real elapsed time, it doesn't rely on the cron
-- interval lining up with 24h/48h exactly.
DO $$
BEGIN
  EXECUTE 'CREATE EXTENSION IF NOT EXISTS pg_cron';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron could not be enabled (%). Enable it via Supabase Dashboard > Database > Extensions, then run: SELECT cron.schedule(''escalate-lead-routings-hourly'', ''0 * * * *'', ''SELECT escalate_all_pending_leads();'');', SQLERRM;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('escalate-lead-routings-hourly');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.schedule(
    'escalate-lead-routings-hourly',
    '0 * * * *',
    $cron$SELECT escalate_all_pending_leads();$cron$
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not schedule the pg_cron job (%). If pg_cron is not enabled on this Supabase plan, enable it via Dashboard > Database > Extensions, then run: SELECT cron.schedule(''escalate-lead-routings-hourly'', ''0 * * * *'', ''SELECT escalate_all_pending_leads();'');', SQLERRM;
END $$;

-- ============================================================================
-- 5. route_all_orphaned_leads / route_orphaned_leads_to_broker both filtered
--    on leads.status != 'archived', which no longer exists. Replaced with
--    reports.broker_contact_opted_in = TRUE — the actual "is this homeowner
--    still open to contact" flag, which the old archived check was only
--    ever standing in for. Otherwise unchanged from their 034/027 versions.
-- ============================================================================

CREATE OR REPLACE FUNCTION route_all_orphaned_leads()
RETURNS INTEGER AS $$
DECLARE
  routed_count INTEGER;
BEGIN
  INSERT INTO lead_routings (lead_id, broker_id, delivery_channel)
  SELECT lead_id, user_id, delivery_channel
  FROM (
    SELECT
      l.id AS lead_id,
      bp.user_id,
      CASE
        WHEN bp.email_enabled THEN 'email'
        WHEN bp.push_enabled THEN 'push'
        ELSE 'email'
      END AS delivery_channel,
      r.requested_broker_count,
      ROW_NUMBER() OVER (
        PARTITION BY l.id
        ORDER BY s.started_at
      ) AS rn
    FROM leads l
    JOIN reports r ON r.id = l.report_id
    JOIN broker_profiles bp ON bp.selected_cities @> ARRAY[l.city_id]
    JOIN subscriptions s ON s.broker_id = bp.user_id AND s.status = 'active'
    WHERE l.city_id IS NOT NULL
      AND r.broker_contact_opted_in = TRUE
      AND NOT EXISTS (SELECT 1 FROM lead_routings lr WHERE lr.lead_id = l.id)
  ) ranked
  WHERE requested_broker_count IS NULL OR rn <= requested_broker_count;

  GET DIAGNOSTICS routed_count = ROW_COUNT;
  RETURN routed_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also drops the dead v_tier/digest_date remnants 034 already cleaned out
-- of route_lead_to_brokers/route_all_orphaned_leads but left untouched
-- here (034's own comment: "needs no change" — true until this migration
-- removed leads.status out from under it).
CREATE OR REPLACE FUNCTION route_orphaned_leads_to_broker(p_broker_id UUID)
RETURNS INTEGER AS $$
DECLARE
  routed_count INTEGER;
  v_cities UUID[];
  v_channel TEXT;
BEGIN
  SELECT
    bp.selected_cities,
    CASE
      WHEN bp.email_enabled THEN 'email'
      WHEN bp.push_enabled THEN 'push'
      ELSE 'email'
    END
  INTO v_cities, v_channel
  FROM broker_profiles bp
  WHERE bp.user_id = p_broker_id;

  IF v_cities IS NULL OR array_length(v_cities, 1) IS NULL THEN
    RETURN 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM subscriptions WHERE broker_id = p_broker_id AND status = 'active'
  ) THEN
    RETURN 0;
  END IF;

  INSERT INTO lead_routings (lead_id, broker_id, delivery_channel)
  SELECT
    l.id,
    p_broker_id,
    v_channel
  FROM leads l
  JOIN reports r ON r.id = l.report_id
  WHERE l.city_id = ANY(v_cities)
    AND r.broker_contact_opted_in = TRUE
    AND NOT EXISTS (SELECT 1 FROM lead_routings lr WHERE lr.lead_id = l.id);

  GET DIAGNOSTICS routed_count = ROW_COUNT;
  RETURN routed_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
