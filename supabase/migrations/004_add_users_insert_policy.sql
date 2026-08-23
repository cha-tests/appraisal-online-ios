-- Add INSERT policy for users table to allow signup
CREATE POLICY "Users can insert own record" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);
