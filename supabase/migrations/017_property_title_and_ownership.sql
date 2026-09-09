-- Clause 5 of the "Verified Sellers Spec": ownership/selling-intent
-- questions and an optional land-title upload, both asked only when the
-- consumer opts to connect with a broker (never on the fast initial
-- appraisal flow — see report.service.ts's updateBrokerOptIn). Clause 6:
-- the resulting "title on file" badge brokers see on a lead.

-- ---------------------------------------------------------------------
-- 1. New fields on reports — set together with broker_contact_opted_in
-- ---------------------------------------------------------------------

ALTER TABLE reports
  ADD COLUMN is_owner BOOLEAN,
  ADD COLUMN intends_to_sell BOOLEAN,
  ADD COLUMN title_url TEXT,
  ADD COLUMN title_submitted_at TIMESTAMPTZ;

-- ---------------------------------------------------------------------
-- 2. Storage bucket for land title uploads (private — never public)
--
-- Path convention: <user_id>/<report_id>/title.<ext>. The owning consumer
-- can read/write their own; a broker can read one only through an actual
-- lead_routings row (same scoping as migration 012's "Brokers can view
-- reports for assigned leads" — this is the same rule applied to the file
-- itself instead of the report row).
-- ---------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('property-documents', 'property-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload their own title documents" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'property-documents' AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can view their own title documents" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'property-documents' AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can replace their own title documents" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'property-documents' AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Brokers can view title documents for assigned leads" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'property-documents' AND
    EXISTS (
      SELECT 1 FROM leads
      JOIN lead_routings ON lead_routings.lead_id = leads.id
      WHERE leads.report_id = ((storage.foldername(name))[2])::uuid
        AND lead_routings.broker_id = auth.uid()
    )
  );
