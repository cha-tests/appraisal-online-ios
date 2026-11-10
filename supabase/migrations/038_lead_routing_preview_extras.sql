-- Phase 2 (broker UI) follow-up to migration 037. Building the actual
-- broker screens against get_my_lead_routings() surfaced two gaps in what
-- it returns:
--
-- 1. A broker whose own row is still 'invited' has no way to tell "this
--    lead already has enough claimed brokers elsewhere" from "it's still
--    open" — needed so lead-inbox/lead-detail can show "This lead has
--    already been connected with enough professionals" instead of an
--    active "I want this lead" button once the quota's filled by others.
-- 2. lead-detail.tsx's existing Seller Details section (is_owner,
--    intends_to_sell, the actual title_url to sign a view URL for, not
--    just a yes/no badge) and Comparable Sales section weren't included
--    at all — both are exactly the kind of detail that should stay
--    withheld until claim, same as the rest of the report.

-- CREATE OR REPLACE can't change a TABLE-returning function's column set
-- (Postgres: "cannot change return type of existing function") — drop
-- first, same as any other signature change.
DROP FUNCTION IF EXISTS get_my_lead_routings();

CREATE FUNCTION get_my_lead_routings()
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
  city_country TEXT,
  estimated_value_low BIGINT,
  estimated_value_high BIGINT,
  lead_tags TEXT[],
  has_title_on_file BOOLEAN,
  requested_broker_count INTEGER,
  claimed_count BIGINT,
  property_address TEXT,
  consumer_name TEXT,
  consumer_email TEXT,
  consumer_phone TEXT,
  estimated_value BIGINT,
  is_owner BOOLEAN,
  intends_to_sell BOOLEAN,
  title_url TEXT,
  comparables JSONB
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
    c.country,
    (rpt.confidence_range->>'low')::BIGINT,
    (rpt.confidence_range->>'high')::BIGINT,
    l.lead_tags,
    (rpt.title_url IS NOT NULL),
    rpt.requested_broker_count,
    (SELECT count(*) FROM lead_routings lr2 WHERE lr2.lead_id = lr.lead_id AND lr2.claim_status = 'claimed'),
    CASE WHEN lr.claim_status = 'claimed' THEN l.property_address ELSE NULL END,
    CASE WHEN lr.claim_status = 'claimed' THEN trim(both ' ' from coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')) ELSE NULL END,
    CASE WHEN lr.claim_status = 'claimed' THEN l.consumer_email ELSE NULL END,
    CASE WHEN lr.claim_status = 'claimed' THEN l.consumer_phone ELSE NULL END,
    CASE WHEN lr.claim_status = 'claimed' THEN rpt.estimated_value ELSE NULL END,
    CASE WHEN lr.claim_status = 'claimed' THEN rpt.is_owner ELSE NULL END,
    CASE WHEN lr.claim_status = 'claimed' THEN rpt.intends_to_sell ELSE NULL END,
    CASE WHEN lr.claim_status = 'claimed' THEN rpt.title_url ELSE NULL END,
    CASE WHEN lr.claim_status = 'claimed' THEN rpt.comparables ELSE NULL END
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
