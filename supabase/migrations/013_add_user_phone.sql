-- Add phone column to users table, captured at signup, so a consumer's
-- number is on file once and can be shared with a broker automatically when
-- they opt in for professional contact — instead of asking them to type it
-- in again on every report they opt in on.
ALTER TABLE users ADD COLUMN phone TEXT;

-- Extend the signup trigger (005_auto_create_user_on_signup.sql) to also
-- capture phone from the auth signup metadata, the same way it already
-- does for full_name and user_type.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, user_type, full_name, phone)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'user_type', 'consumer'),
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    new.raw_user_meta_data->>'phone'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
