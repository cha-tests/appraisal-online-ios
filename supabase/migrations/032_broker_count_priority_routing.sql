-- Enforces the cap a consumer sets when opting in ("How many professionals
-- would you like to connect with?", reports.requested_broker_count — added
-- by 026 but never actually read by anything until now). Previously every
-- active, subscribed broker covering the lead's city was routed the lead
-- regardless of that number.
--
-- Decision (Option A of the two raised when this gap was found): the
-- platform picks which brokers get the lead *at routing time*, up to the
-- requested count, rather than notifying everyone and letting the first N
-- to respond claim it. Priority order is the same tier hierarchy already
-- public in the membership tiers table and the marketing-weighting formula
-- (Founder Lifetime, then Premium Annual, then Basic Annual); within a
-- tier, the broker with the longer-standing active subscription in that
-- city goes first, consistent with Lifetime/Premium being pitched as a
-- "founder" position. A NULL requested_broker_count (older reports, or any
-- report that predates this column) keeps today's behavior — uncapped.
--
-- Postgres treats `LIMIT NULL` the same as no LIMIT at all, so passing
-- p_broker_count straight through needs no extra NULL-handling.
--
-- route_lead_to_brokers' argument list is changing (an added third,
-- defaulted parameter is a distinct signature as far as CREATE OR REPLACE
-- is concerned), so the old two-argument function is dropped first —
-- otherwise it would linger as a separate overload and any caller still
-- invoking it with two arguments would keep running the old, uncapped logic.
DROP FUNCTION IF EXISTS route_lead_to_brokers(UUID, UUID);

CREATE OR REPLACE FUNCTION route_lead_to_brokers(
  p_lead_id UUID,
  p_city_id UUID,
  p_broker_count INTEGER DEFAULT NULL
)
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
    ranked.user_id,
    ranked.delivery_channel,
    ranked.digest_date
  FROM (
    SELECT
      bp.user_id,
      CASE
        WHEN bp.email_enabled THEN 'email'
        WHEN bp.push_enabled THEN 'push'
        WHEN bp.sms_enabled THEN 'sms'
        ELSE 'email'
      END AS delivery_channel,
      CASE WHEN bp.tier = 'Basic Annual' THEN next_weekly_digest_date() ELSE NULL END AS digest_date,
      CASE bp.tier
        WHEN 'Founder Lifetime' THEN 1
        WHEN 'Premium Annual' THEN 2
        WHEN 'Basic Annual' THEN 3
        ELSE 4
      END AS tier_rank,
      s.started_at
    FROM broker_profiles bp
    JOIN subscriptions s ON s.broker_id = bp.user_id AND s.status = 'active'
    WHERE bp.selected_cities @> ARRAY[p_city_id]
    ORDER BY tier_rank ASC, s.started_at ASC
    LIMIT p_broker_count
  ) ranked;

  GET DIAGNOSTICS routed_count = ROW_COUNT;
  RETURN routed_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- route_orphaned_leads_to_broker (027) needs no change: it only ever fires
-- for a lead with zero existing lead_routings rows and inserts exactly one
-- (for the broker who just selected the city), taking it from 0 to 1 —
-- always within any cap of 1 or more, which the consumer-facing field
-- already enforces as its minimum (see broker-optins.tsx's validation).
--
-- route_all_orphaned_leads (028) is different: its cross join can match
-- several brokers for the same still-orphaned lead in a single sweep, so
-- it gets the same tier-ranked, cap-respecting treatment via a per-lead
-- window function instead of a LIMIT (a plain LIMIT only bounds the whole
-- result set, not each lead's own share of it).
CREATE OR REPLACE FUNCTION route_all_orphaned_leads()
RETURNS INTEGER AS $$
DECLARE
  routed_count INTEGER;
BEGIN
  INSERT INTO lead_routings (lead_id, broker_id, delivery_channel, digest_date)
  SELECT lead_id, user_id, delivery_channel, digest_date
  FROM (
    SELECT
      l.id AS lead_id,
      bp.user_id,
      CASE
        WHEN bp.email_enabled THEN 'email'
        WHEN bp.push_enabled THEN 'push'
        WHEN bp.sms_enabled THEN 'sms'
        ELSE 'email'
      END AS delivery_channel,
      CASE WHEN bp.tier = 'Basic Annual' THEN next_weekly_digest_date() ELSE NULL END AS digest_date,
      r.requested_broker_count,
      ROW_NUMBER() OVER (
        PARTITION BY l.id
        ORDER BY
          CASE bp.tier
            WHEN 'Founder Lifetime' THEN 1
            WHEN 'Premium Annual' THEN 2
            WHEN 'Basic Annual' THEN 3
            ELSE 4
          END,
          s.started_at
      ) AS rn
    FROM leads l
    JOIN reports r ON r.id = l.report_id
    JOIN broker_profiles bp ON bp.selected_cities @> ARRAY[l.city_id]
    JOIN subscriptions s ON s.broker_id = bp.user_id AND s.status = 'active'
    WHERE l.city_id IS NOT NULL
      AND l.status != 'archived'
      AND NOT EXISTS (SELECT 1 FROM lead_routings lr WHERE lr.lead_id = l.id)
  ) ranked
  WHERE requested_broker_count IS NULL OR rn <= requested_broker_count;

  GET DIAGNOSTICS routed_count = ROW_COUNT;
  RETURN routed_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
