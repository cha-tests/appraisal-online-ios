-- Storage bucket for broker profile photos. Unlike kyc-documents (private,
-- admin-reviewed only), this is meant to be shown to consumers browsing
-- brokers, so it's public — same per-user-folder convention as
-- kyc-documents for who may upload/replace, but world-readable.

INSERT INTO storage.buckets (id, name, public)
VALUES ('broker-photos', 'broker-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Brokers can upload their own profile photo" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'broker-photos' AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Brokers can replace their own profile photo" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'broker-photos' AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Anyone can view broker profile photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'broker-photos');
