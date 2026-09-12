-- Split users.full_name into first_name/last_name — B2B best practice for
-- the broker side (proper salutations in emails/reports, CRM sorting,
-- formal documents) and kept consistent on the consumer side too rather
-- than having two different name shapes in the same table.
ALTER TABLE users ADD COLUMN first_name TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN last_name TEXT DEFAULT '';

-- Best-effort backfill for any existing rows: first word -> first_name,
-- the rest -> last_name. Fine for this project's stage (test/demo accounts
-- only, no real user base yet).
UPDATE users
SET
  first_name = split_part(full_name, ' ', 1),
  last_name = trim(substring(full_name FROM position(' ' IN full_name) + 1))
WHERE full_name IS NOT NULL AND full_name != '' AND position(' ' IN full_name) > 0;

UPDATE users
SET first_name = full_name
WHERE full_name IS NOT NULL AND full_name != '' AND position(' ' IN full_name) = 0;

ALTER TABLE users DROP COLUMN full_name;

-- Extend the signup trigger (005_auto_create_user_on_signup.sql, extended by
-- 013_add_user_phone.sql) to read first_name/last_name from auth signup
-- metadata instead of full_name.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, user_type, first_name, last_name, phone)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'user_type', 'consumer'),
    COALESCE(new.raw_user_meta_data->>'first_name', ''),
    COALESCE(new.raw_user_meta_data->>'last_name', ''),
    new.raw_user_meta_data->>'phone'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
