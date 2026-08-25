-- Seed Philippine cities (first market outside the US).
--
-- The `state` column was originally documented as "US state code". It now
-- holds whichever subnational unit the country uses: state code for the US,
-- province or region for the Philippines. The broker city picker renders
-- "{name}, {state}", so these values are user-facing — "Makati, Metro Manila"
-- reads correctly next to "Miami, FL".
COMMENT ON COLUMN cities.state IS
  'Subnational unit: US state code, or province/region elsewhere (e.g. Metro Manila).';

-- Population figures are approximate 2020 PSA census counts, rounded to the
-- nearest thousand. They feed marketing_budget_share weighting, so verify them
-- against the official PSA figures before using them to allocate real spend.
INSERT INTO cities (name, state, country, population) VALUES
  -- Metro Manila (NCR)
  ('Quezon City',    'Metro Manila',      'PH', 2960000),
  ('Manila',         'Metro Manila',      'PH', 1847000),
  ('Caloocan',       'Metro Manila',      'PH', 1662000),
  ('Taguig',         'Metro Manila',      'PH',  887000),
  ('Pasig',          'Metro Manila',      'PH',  803000),
  ('Parañaque',      'Metro Manila',      'PH',  690000),
  ('Makati',         'Metro Manila',      'PH',  630000),
  ('Mandaluyong',    'Metro Manila',      'PH',  426000),
  -- Key regional markets
  ('Davao City',     'Davao del Sur',     'PH', 1777000),
  ('Cebu City',      'Cebu',              'PH',  964000),
  ('Antipolo',       'Rizal',             'PH',  887000),
  ('Cagayan de Oro', 'Misamis Oriental',  'PH',  728000),
  ('Bacolod',        'Negros Occidental', 'PH',  601000),
  ('Iloilo City',    'Iloilo',            'PH',  458000),
  ('Baguio',         'Benguet',           'PH',  366000)
-- cities has UNIQUE(name, state, country), so re-running this is a no-op
-- rather than creating duplicates.
ON CONFLICT (name, state, country) DO NOTHING;
