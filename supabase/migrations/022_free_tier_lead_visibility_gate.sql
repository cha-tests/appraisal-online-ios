-- Oct 2026 provisional decision (see CLAUDE.md's broker-tier note, flagged
-- to re-confirm before every build): Free-tier (stored as 'Basic Annual')
-- leads should be held back from a broker's Lead Inbox entirely until the
-- next weekly digest release, not shown the moment they're routed the way
-- Premium/Founder tier leads are.
--
-- Reuses `lead_routings.digest_date` — present since 001_initial_schema.sql
-- but never actually populated or read by anything until now. No cron or
-- email sender is wired up yet (that's separate future work, intentionally
-- out of scope here) — this migration only gates *visibility*: once a
-- row's digest_date's Monday 9 AM Philippine-time mark has passed, it
-- becomes visible on its own, with nothing needing to actively "release" it.

-- Next Monday 9 AM Philippine time strictly after now — the current week's
-- Monday if that hasn't passed yet, otherwise the following week's.
CREATE OR REPLACE FUNCTION next_weekly_digest_date()
RETURNS DATE AS $$
DECLARE
  local_now TIMESTAMP;
  candidate_monday DATE;
BEGIN
  local_now := now() AT TIME ZONE 'Asia/Manila';
  candidate_monday := date_trunc('week', local_now)::date;
  IF (candidate_monday + TIME '09:00') <= local_now THEN
    candidate_monday := candidate_monday + 7;
  END IF;
  RETURN candidate_monday;
END;
$$ LANGUAGE plpgsql STABLE;

-- Same routing logic as 008_lead_routing.sql, with one addition: a Free
-- tier (Basic Annual) match gets a digest_date set to the next release;
-- every other tier gets NULL, meaning "not digest-gated, visible now" —
-- unchanged from today's real-time behavior.
CREATE OR REPLACE FUNCTION route_lead_to_brokers(p_lead_id UUID, p_city_id UUID)
RETURNS INTEGER AS $$
DECLARE
  routed_count INTEGER;
BEGIN
  IF p_city_id IS NULL THEN
    RETURN 0;
  END IF;

  INSERT INTO lead_routings (lead_id, broker_id, delivery_channel, digest_date)
  SELECT
    p_lead_id,
    bp.user_id,
    CASE
      WHEN bp.email_enabled THEN 'email'
      WHEN bp.push_enabled THEN 'push'
      WHEN bp.sms_enabled THEN 'sms'
      ELSE 'email'
    END,
    CASE WHEN bp.tier = 'Basic Annual' THEN next_weekly_digest_date() ELSE NULL END
  FROM broker_profiles bp
  JOIN subscriptions s ON s.broker_id = bp.user_id AND s.status = 'active'
  WHERE bp.selected_cities @> ARRAY[p_city_id];

  GET DIAGNOSTICS routed_count = ROW_COUNT;
  RETURN routed_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Gate visibility at the RLS layer, not just in the app's own queries — a
-- broker's Lead Inbox, dashboard, and lead-detail screens all query
-- lead_routings directly or (010, 012) through an EXISTS subquery against
-- it for leads/properties/reports/consumer-info access, so restricting it
-- here cascades to all of them automatically without touching app code.
ALTER POLICY "Brokers can view own lead routings" ON lead_routings
  USING (
    auth.uid() = broker_id
    AND (
      digest_date IS NULL
      OR (digest_date + TIME '09:00') AT TIME ZONE 'Asia/Manila' <= now()
    )
  );
