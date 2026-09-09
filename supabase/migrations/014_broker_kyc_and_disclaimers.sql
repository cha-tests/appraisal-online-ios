-- Adds broker/salesperson role + KYC verification, and a log of which
-- disclaimer text a user has accepted (client-side and broker-side are
-- separate documents — see config/disclaimers.ts on the mobile side for the
-- text this refers to). Both were decided at the Sep 1, 2026 sync-up and
-- written up in the "Verified Sellers & Broker Trust" functional spec.

-- ---------------------------------------------------------------------
-- 1. Broker role + KYC fields
-- ---------------------------------------------------------------------

ALTER TABLE broker_profiles
  ADD COLUMN role TEXT NOT NULL DEFAULT 'broker' CHECK (role IN ('broker', 'salesperson')),
  ADD COLUMN kyc_status TEXT NOT NULL DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN kyc_id_url TEXT,
  ADD COLUMN kyc_selfie_url TEXT,
  ADD COLUMN kyc_submitted_at TIMESTAMPTZ,
  ADD COLUMN kyc_reviewed_at TIMESTAMPTZ,
  ADD COLUMN kyc_rejection_reason TEXT;

-- ---------------------------------------------------------------------
-- 2. Disclaimer acceptance log
--
-- One row per (user, disclaimer_type) acceptance. `version` lets wording
-- changes force re-acceptance later without losing the history of what an
-- existing user actually agreed to at the time.
-- ---------------------------------------------------------------------

CREATE TABLE disclaimer_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  disclaimer_type TEXT NOT NULL CHECK (disclaimer_type IN ('client', 'broker')),
  version TEXT NOT NULL,
  context JSONB,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_disclaimer_acceptances_user ON disclaimer_acceptances(user_id);

ALTER TABLE disclaimer_acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can log their own disclaimer acceptance" ON disclaimer_acceptances
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own disclaimer acceptances" ON disclaimer_acceptances
  FOR SELECT USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 3. Storage bucket for KYC documents (private — never public)
--
-- Path convention: <user_id>/id.<ext> and <user_id>/selfie.<ext>. Policies
-- below scope both upload and read to the owning user, matching the
-- convention already used for other per-user data in this schema.
-- ---------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-documents', 'kyc-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload their own KYC documents" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can view their own KYC documents" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can replace their own KYC documents" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = auth.uid()::text
  );
