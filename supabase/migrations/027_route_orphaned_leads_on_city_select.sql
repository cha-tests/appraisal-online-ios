-- Fixes a real gap: route_lead_to_brokers (008_lead_routing.sql) only runs
-- once, at the moment a consumer opts in. If no broker has selected that
-- lead's city yet (or none with an active subscription), the INSERT ...
-- SELECT simply matches zero rows — the lead sits in `leads` with no
-- `lead_routings` row at all, and nothing ever revisits it. A broker who
-- later subscribes to that exact city still never sees it, even months
-- later, since routing was never retried.
--
-- This adds the other half: when a broker selects (or adds) a city, check
-- for any lead in that city that has NEVER been routed to anyone — not
-- "routed to someone else, available again," specifically zero rows in
-- lead_routings — and route it to this broker now. Leads that already went
-- to at least one broker are left alone; this only rescues leads that
-- would otherwise never reach anyone.

CREATE OR REPLACE FUNCTION route_orphaned_leads_to_broker(p_broker_id UUID)
RETURNS INTEGER AS $$
DECLARE
  routed_count INTEGER;
  v_cities UUID[];
  v_tier TEXT;
  v_channel TEXT;
BEGIN
  SELECT
    bp.selected_cities,
    bp.tier,
    CASE
      WHEN bp.email_enabled THEN 'email'
      WHEN bp.push_enabled THEN 'push'
      WHEN bp.sms_enabled THEN 'sms'
      ELSE 'email'
    END
  INTO v_cities, v_tier, v_channel
  FROM broker_profiles bp
  WHERE bp.user_id = p_broker_id;

  IF v_cities IS NULL OR array_length(v_cities, 1) IS NULL THEN
    RETURN 0;
  END IF;

  -- Same gate as route_lead_to_brokers: tier alone isn't proof of payment,
  -- only a confirmed active subscription is.
  IF NOT EXISTS (
    SELECT 1 FROM subscriptions WHERE broker_id = p_broker_id AND status = 'active'
  ) THEN
    RETURN 0;
  END IF;

  INSERT INTO lead_routings (lead_id, broker_id, delivery_channel, digest_date)
  SELECT
    l.id,
    p_broker_id,
    v_channel,
    CASE WHEN v_tier = 'Basic Annual' THEN next_weekly_digest_date() ELSE NULL END
  FROM leads l
  WHERE l.city_id = ANY(v_cities)
    AND l.status != 'archived'
    AND NOT EXISTS (SELECT 1 FROM lead_routings lr WHERE lr.lead_id = l.id);

  GET DIAGNOSTICS routed_count = ROW_COUNT;
  RETURN routed_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION route_orphaned_leads_to_broker(UUID) TO authenticated;
