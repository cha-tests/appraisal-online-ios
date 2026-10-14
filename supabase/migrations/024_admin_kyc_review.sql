-- Admin panel for broker KYC verification. Previously the only way to
-- approve/reject a broker's uploaded ID + selfie was scripts/review-kyc.ts,
-- run by hand with the service-role key. This adds a real in-app admin
-- role so staff can do the same review from web/app/admin instead.

ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Admins can see every broker's profile (not just their own), so the
-- pending-review queue can list everyone awaiting a decision.
CREATE POLICY "Admins can view all broker profiles" ON broker_profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
  );

-- Admins can set kyc_status/kyc_reviewed_at/kyc_rejection_reason on any
-- broker's row — same UPDATE grant brokers already have on their own row,
-- just not scoped to auth.uid() = user_id.
CREATE POLICY "Admins can update broker KYC status" ON broker_profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
  );

-- Admins can read any broker's uploaded ID/selfie, not just their own
-- folder — needed to actually review the photos before deciding.
CREATE POLICY "Admins can view any KYC document" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'kyc-documents'
    AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true)
  );
