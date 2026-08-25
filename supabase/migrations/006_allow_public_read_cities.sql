-- Cities are public reference data: the broker splash screen shows founder
-- availability per city, and broker onboarding requires selecting coverage
-- cities. RLS is enabled on the table but no SELECT policy existed, so both
-- anonymous and authenticated clients read zero rows.

ALTER TABLE cities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Cities are readable by everyone" ON cities;
CREATE POLICY "Cities are readable by everyone"
  ON cities
  FOR SELECT
  USING (true);
