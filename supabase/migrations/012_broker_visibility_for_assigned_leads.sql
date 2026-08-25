-- Same bug class as 008-011, found while fixing the distance-unit display:
-- properties, reports, and users are all scoped to "the owning consumer sees
-- only their own row" — correct in isolation, but it means a broker can never
-- read the property/report/consumer data behind a lead that was genuinely
-- routed to them. Confirmed live: lead-detail.tsx's join for comparables and
-- dashboard.tsx's join for the consumer's email both resolved to `null` for
-- the assigned broker's own session, even after fixing the query syntax
-- itself (the earlier 300 "ambiguous embed" error). RLS was blocking the
-- embed targets, not the join shape.
--
-- Each policy is scoped as narrowly as the existing "Brokers can view
-- assigned leads" policy on `leads` (010) — visible only through an actual
-- lead_routings row for that broker, not "any broker can read any consumer's
-- data."

CREATE POLICY "Brokers can view properties for assigned leads" ON properties
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM leads
      JOIN lead_routings ON lead_routings.lead_id = leads.id
      WHERE leads.property_id = properties.id
        AND lead_routings.broker_id = auth.uid()
    )
  );

CREATE POLICY "Brokers can view reports for assigned leads" ON reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM leads
      JOIN lead_routings ON lead_routings.lead_id = leads.id
      WHERE leads.report_id = reports.id
        AND lead_routings.broker_id = auth.uid()
    )
  );

CREATE POLICY "Brokers can view consumer info for assigned leads" ON users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM leads
      JOIN lead_routings ON lead_routings.lead_id = leads.id
      WHERE leads.consumer_id = users.id
        AND lead_routings.broker_id = auth.uid()
    )
  );
