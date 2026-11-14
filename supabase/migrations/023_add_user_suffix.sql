-- Optional name suffix (Jr., Sr., III, etc.) for both consumer and broker
-- signup — same table, same trigger as first_name/last_name (020).
ALTER TABLE users ADD COLUMN suffix TEXT;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, user_type, first_name, last_name, suffix, phone)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'user_type', 'consumer'),
    COALESCE(new.raw_user_meta_data->>'first_name', ''),
    COALESCE(new.raw_user_meta_data->>'last_name', ''),
    NULLIF(new.raw_user_meta_data->>'suffix', ''),
    new.raw_user_meta_data->>'phone'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
