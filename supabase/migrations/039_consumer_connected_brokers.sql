-- Phase 3 (consumer UI) of the claim-based lead routing redesign.
-- Mirrors get_my_lead_routings() (migrations 037/038) but for the
-- consumer side: one row per lead_routings entry across every lead this
-- consumer has created, with the routed broker's public listing info
-- (company name, own name — not sensitive, it's what a broker's profile
-- already shows publicly) rather than the homeowner's own PII, which the
-- consumer obviously already has. SECURITY DEFINER so it can read
-- broker_profiles/users for a broker other than the caller, same
-- justification as every other cross-row read in this schema.

CREATE OR REPLACE FUNCTION get_my_connected_brokers()
RETURNS TABLE (
  lead_routing_id UUID,
  lead_id UUID,
  report_id UUID,
  property_address TEXT,
  broker_id UUID,
  broker_company_name TEXT,
  broker_first_name TEXT,
  broker_last_name TEXT,
  claim_status TEXT,
  status TEXT,
  invited_at TIMESTAMP WITH TIME ZONE,
  claimed_at TIMESTAMP WITH TIME ZONE
) AS $$
  SELECT
    lr.id,
    lr.lead_id,
    l.report_id,
    l.property_address,
    lr.broker_id,
    bp.company_name,
    u.first_name,
    u.last_name,
    lr.claim_status,
    lr.status,
    lr.created_at,
    lr.claimed_at
  FROM lead_routings lr
  JOIN leads l ON l.id = lr.lead_id
  LEFT JOIN broker_profiles bp ON bp.user_id = lr.broker_id
  LEFT JOIN users u ON u.id = lr.broker_id
  WHERE l.consumer_id = auth.uid()
  ORDER BY l.created_at DESC, lr.created_at ASC;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION get_my_connected_brokers() TO authenticated;
