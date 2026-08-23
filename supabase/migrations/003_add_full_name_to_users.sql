-- Add full_name column to users table
ALTER TABLE users ADD COLUMN full_name TEXT DEFAULT '';

-- Update RLS policy to allow reading full_name
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
