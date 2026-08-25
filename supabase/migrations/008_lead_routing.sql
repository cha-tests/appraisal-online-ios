-- Fixes lead routing, which has been broken from two directions:
--
-- 1. `reports` and `leads` had RLS enabled (001_initial_schema.sql) with
--    SELECT-only policies — no INSERT policy existed for either table.
--    Verified live against the test consumer account: inserting a report
--    returns 42501 "new row violates row-level security policy for table
--    reports". So no consumer has ever been able to save a valuation, which
--    means the lead that should follow from it was equally unreachable.
--
-- 2. Even with leads insertable, matching a lead's city against brokers
--    requires reading broker_profiles.selected_cities and subscriptions.status
--    for brokers other than the caller. A consumer's own RLS session correctly
--    cannot do that — those tables are intentionally scoped to "a broker sees
--    only their own row" — so this can't be done as a plain client-side query
--    no matter how the query itself is written. It needs to run with elevated
--    privilege, the same way check_founder_capacity/get_founder_number already
--    read across broker_profiles for capacity checks.

-- A consumer can create a report for themselves (mirrors the existing
-- "Consumers can create properties" policy, which uses the same shape).
CREATE POLICY "Consumers can create own reports" ON reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- A consumer can create a lead about themselves. This does not touch other
-- users' data — matching that lead to brokers is a separate step, below.
CREATE POLICY "Consumers can create own leads" ON leads
  FOR INSERT WITH CHECK (auth.uid() = consumer_id);

-- Matches a lead's city against subscribed, currently-paying brokers and
-- inserts one lead_routings row per match. SECURITY DEFINER so it can read
-- broker_profiles and subscriptions across brokers regardless of the calling
-- consumer's own RLS restrictions — the same mechanism this schema already
-- relies on elsewhere for cross-broker reads.
--
-- Gating on subscriptions.status = 'active' is deliberate: broker_profiles.tier
-- is set at profile creation, before any payment, so tier alone does not mean
-- paid. Only a confirmed, active subscription should receive a lead.
--
-- Returns the number of brokers routed to, so the caller can tell "no match"
-- (0) apart from a hard failure (the call would raise instead).
CREATE OR REPLACE FUNCTION route_lead_to_brokers(p_lead_id UUID, p_city_id UUID)
RETURNS INTEGER AS $$
DECLARE
  routed_count INTEGER;
BEGIN
  IF p_city_id IS NULL THEN
    RETURN 0;
  END IF;

  INSERT INTO lead_routings (lead_id, broker_id, delivery_channel)
  SELECT
    p_lead_id,
    bp.user_id,
    -- Preference order reflects what can actually send today (Postmark email
    -- exists; push and SMS delivery do not yet). This only records intent —
    -- something else is responsible for actually sending and updating
    -- delivery_status.
    CASE
      WHEN bp.email_enabled THEN 'email'
      WHEN bp.push_enabled THEN 'push'
      WHEN bp.sms_enabled THEN 'sms'
      ELSE 'email'
    END
  FROM broker_profiles bp
  JOIN subscriptions s ON s.broker_id = bp.user_id AND s.status = 'active'
  WHERE bp.selected_cities @> ARRAY[p_city_id];

  GET DIAGNOSTICS routed_count = ROW_COUNT;
  RETURN routed_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION route_lead_to_brokers(UUID, UUID) TO authenticated;
