-- Expands the cities table well beyond 007's original 15 Philippine cities,
-- to support the broker onboarding country/city picker now that it's open
-- to every country (see mobile/config/countries.ts) rather than gated to
-- PH/US.
--
-- SOURCING AND KNOWN GAPS — read before treating this as authoritative:
-- This was compiled from a research pass that could not reach live sources
-- (Wikipedia/PSA/census.gov were all blocked by this environment's network
-- policy), so it's built from general knowledge and cross-checked only
-- where web search snippets happened to confirm a fact. Known gaps:
--   * Philippines: the official city count is 149 (33 highly-urbanized +
--     5 independent-component + 111 component cities) as of Carmona,
--     Cavite's cityhood in July 2023. This migration's component-city list
--     has ~106 of the 111 — roughly 5 component cities are missing because
--     they couldn't be reliably recalled/verified. Diff against the
--     Philippine Statistics Authority's official list before relying on
--     this for anything beyond development/testing.
--   * Four provinces' conventional "capital" is actually an independent
--     city (Iloilo City for Iloilo, Tacloban City for Leyte, Cagayan de
--     Oro for Misamis Oriental, Isabela City for Basilan) rather than a
--     province-governed municipality. Since this schema has no separate
--     "provinces" table, these aren't given their own row — the city
--     itself (already present) stands in for the province's seat.
--   * US and Australia lists are standard, stable geography (state/
--     territory capitals + largest cities) and lower-risk, but weren't
--     independently re-verified against a live source either.
-- Treat this as a strong first pass for testing, not a production-ready
-- authoritative dataset — real population figures and any missing PH
-- component cities should be reconciled against PSA data before launch.

-- ============================================================
-- Philippines — remaining Highly Urbanized Cities (19 of 33;
-- the other 14 were seeded in 007)
-- ============================================================
INSERT INTO cities (name, state, country) VALUES
  ('Las Piñas',      'Metro Manila',        'PH'),
  ('Malabon',        'Metro Manila',        'PH'),
  ('Marikina',       'Metro Manila',        'PH'),
  ('Muntinlupa',     'Metro Manila',        'PH'),
  ('Navotas',        'Metro Manila',        'PH'),
  ('Pasay',          'Metro Manila',        'PH'),
  ('San Juan',       'Metro Manila',        'PH'),
  ('Valenzuela',     'Metro Manila',        'PH'),
  ('Angeles City',   'Pampanga',            'PH'),
  ('Butuan',         'Agusan del Norte',    'PH'),
  ('General Santos', 'South Cotabato',      'PH'),
  ('Iligan',         'Lanao del Norte',     'PH'),
  ('Lapu-Lapu',      'Cebu',                'PH'),
  ('Lucena',         'Quezon',              'PH'),
  ('Mandaue',        'Cebu',                'PH'),
  ('Olongapo',       'Zambales',            'PH'),
  ('Puerto Princesa','Palawan',             'PH'),
  ('Tacloban',       'Leyte',               'PH'),
  ('Zamboanga City', 'Zamboanga del Sur',   'PH')
ON CONFLICT (name, state, country) DO NOTHING;

-- ============================================================
-- Philippines — Independent Component Cities (all 5)
-- ============================================================
INSERT INTO cities (name, state, country) VALUES
  ('Cotabato City', 'Maguindanao del Norte', 'PH'),
  ('Dagupan',       'Pangasinan',            'PH'),
  ('Naga',          'Camarines Sur',         'PH'),
  ('Ormoc',         'Leyte',                 'PH'),
  ('Santiago',      'Isabela',               'PH')
ON CONFLICT (name, state, country) DO NOTHING;

-- ============================================================
-- Philippines — Component Cities (~106 of 111 — see gaps note above)
-- ============================================================
INSERT INTO cities (name, state, country) VALUES
  ('Laoag',            'Ilocos Norte',        'PH'),
  ('Batac',            'Ilocos Norte',        'PH'),
  ('Candon',           'Ilocos Sur',          'PH'),
  ('Vigan',            'Ilocos Sur',          'PH'),
  ('San Fernando',     'La Union',            'PH'),
  ('Alaminos',         'Pangasinan',          'PH'),
  ('San Carlos',       'Pangasinan',          'PH'),
  ('Urdaneta',         'Pangasinan',          'PH'),
  ('Tuguegarao',       'Cagayan',             'PH'),
  ('Cauayan',          'Isabela',             'PH'),
  ('Ilagan',           'Isabela',             'PH'),
  ('Balanga',          'Bataan',              'PH'),
  ('Malolos',          'Bulacan',             'PH'),
  ('Meycauayan',       'Bulacan',             'PH'),
  ('San Jose del Monte','Bulacan',            'PH'),
  ('Cabanatuan',       'Nueva Ecija',         'PH'),
  ('Gapan',            'Nueva Ecija',         'PH'),
  ('Science City of Muñoz', 'Nueva Ecija',    'PH'),
  ('Palayan',          'Nueva Ecija',         'PH'),
  ('San Jose',          'Nueva Ecija',        'PH'),
  ('Mabalacat',        'Pampanga',            'PH'),
  ('San Fernando',     'Pampanga',            'PH'),
  ('Tarlac City',      'Tarlac',              'PH'),
  ('Batangas City',    'Batangas',            'PH'),
  ('Lipa',             'Batangas',            'PH'),
  ('Tanauan',          'Batangas',            'PH'),
  ('Bacoor',           'Cavite',              'PH'),
  ('Carmona',          'Cavite',              'PH'),
  ('Cavite City',      'Cavite',              'PH'),
  ('Dasmariñas',       'Cavite',              'PH'),
  ('General Trias',    'Cavite',              'PH'),
  ('Imus',             'Cavite',              'PH'),
  ('Tagaytay',         'Cavite',              'PH'),
  ('Trece Martires',   'Cavite',              'PH'),
  ('Biñan',            'Laguna',              'PH'),
  ('Cabuyao',          'Laguna',              'PH'),
  ('Calamba',          'Laguna',              'PH'),
  ('San Pablo',        'Laguna',              'PH'),
  ('Santa Rosa',       'Laguna',              'PH'),
  ('Tayabas',          'Quezon',              'PH'),
  ('Calapan',          'Oriental Mindoro',    'PH'),
  ('Legazpi',          'Albay',               'PH'),
  ('Ligao',            'Albay',               'PH'),
  ('Tabaco',           'Albay',               'PH'),
  ('Iriga',            'Camarines Sur',       'PH'),
  ('Masbate City',     'Masbate',             'PH'),
  ('Sorsogon City',    'Sorsogon',            'PH'),
  ('Roxas City',       'Capiz',               'PH'),
  ('Passi',            'Iloilo',              'PH'),
  ('Bago',             'Negros Occidental',   'PH'),
  ('Cadiz',            'Negros Occidental',   'PH'),
  ('Escalante',        'Negros Occidental',   'PH'),
  ('Himamaylan',       'Negros Occidental',   'PH'),
  ('Kabankalan',       'Negros Occidental',   'PH'),
  ('La Carlota',       'Negros Occidental',   'PH'),
  ('Sagay',            'Negros Occidental',   'PH'),
  ('San Carlos',       'Negros Occidental',   'PH'),
  ('Silay',            'Negros Occidental',   'PH'),
  ('Sipalay',          'Negros Occidental',   'PH'),
  ('Talisay',          'Negros Occidental',   'PH'),
  ('Victorias',        'Negros Occidental',   'PH'),
  ('Tagbilaran',       'Bohol',               'PH'),
  ('Bogo',             'Cebu',                'PH'),
  ('Carcar',           'Cebu',                'PH'),
  ('Danao',            'Cebu',                'PH'),
  ('Naga',             'Cebu',                'PH'),
  ('Talisay',          'Cebu',                'PH'),
  ('Toledo',           'Cebu',                'PH'),
  ('Dumaguete',        'Negros Oriental',     'PH'),
  ('Bais',             'Negros Oriental',     'PH'),
  ('Bayawan',          'Negros Oriental',     'PH'),
  ('Canlaon',          'Negros Oriental',     'PH'),
  ('Guihulngan',       'Negros Oriental',     'PH'),
  ('Tanjay',           'Negros Oriental',     'PH'),
  ('Baybay',           'Leyte',               'PH'),
  ('Calbayog',         'Samar',               'PH'),
  ('Catbalogan',       'Samar',               'PH'),
  ('Borongan',         'Eastern Samar',       'PH'),
  ('Maasin',           'Southern Leyte',      'PH'),
  ('Dipolog',          'Zamboanga del Norte', 'PH'),
  ('Dapitan',          'Zamboanga del Norte', 'PH'),
  ('Pagadian',         'Zamboanga del Sur',   'PH'),
  ('Malaybalay',       'Bukidnon',            'PH'),
  ('Valencia',         'Bukidnon',            'PH'),
  ('Oroquieta',        'Misamis Occidental',  'PH'),
  ('Ozamiz',           'Misamis Occidental',  'PH'),
  ('Tangub',           'Misamis Occidental',  'PH'),
  ('Gingoog',          'Misamis Oriental',    'PH'),
  ('El Salvador',      'Misamis Oriental',    'PH'),
  ('Panabo',           'Davao del Norte',     'PH'),
  ('Island Garden City of Samal', 'Davao del Norte', 'PH'),
  ('Tagum',            'Davao del Norte',     'PH'),
  ('Digos',            'Davao del Sur',       'PH'),
  ('Mati',             'Davao Oriental',      'PH'),
  ('Kidapawan',        'Cotabato',            'PH'),
  ('Koronadal',        'South Cotabato',      'PH'),
  ('Tacurong',         'Sultan Kudarat',      'PH'),
  ('Cabadbaran',       'Agusan del Norte',    'PH'),
  ('Bayugan',          'Agusan del Sur',      'PH'),
  ('Surigao City',     'Surigao del Norte',   'PH'),
  ('Bislig',           'Surigao del Sur',     'PH'),
  ('Tandag',           'Surigao del Sur',     'PH'),
  ('Isabela City',     'Basilan',             'PH'),
  ('Lamitan',          'Basilan',             'PH'),
  ('Marawi',           'Lanao del Sur',       'PH'),
  ('Tabuk',            'Kalinga',             'PH')
ON CONFLICT (name, state, country) DO NOTHING;

-- ============================================================
-- Philippines — provincial capitals that are municipalities, not
-- already-seeded cities (36 rows; provinces whose capital is already a
-- city above, e.g. Ilocos Norte -> Laoag, are intentionally not repeated)
-- ============================================================
INSERT INTO cities (name, state, country) VALUES
  ('Lingayen',              'Pangasinan',              'PH'),
  ('Basco',                 'Batanes',                 'PH'),
  ('Bayombong',             'Nueva Vizcaya',           'PH'),
  ('Cabarroguis',           'Quirino',                 'PH'),
  ('Baler',                 'Aurora',                  'PH'),
  ('Iba',                   'Zambales',                'PH'),
  ('Santa Cruz',            'Laguna',                  'PH'),
  ('Boac',                  'Marinduque',              'PH'),
  ('Mamburao',              'Occidental Mindoro',      'PH'),
  ('Romblon',               'Romblon',                 'PH'),
  ('Daet',                  'Camarines Norte',         'PH'),
  ('Pili',                  'Camarines Sur',           'PH'),
  ('Virac',                 'Catanduanes',             'PH'),
  ('Kalibo',                'Aklan',                   'PH'),
  ('San Jose de Buenavista','Antique',                 'PH'),
  ('Jordan',                'Guimaras',                'PH'),
  ('Siquijor',              'Siquijor',                'PH'),
  ('Naval',                 'Biliran',                 'PH'),
  ('Catarman',              'Northern Samar',          'PH'),
  ('Ipil',                  'Zamboanga Sibugay',       'PH'),
  ('Mambajao',              'Camiguin',                'PH'),
  ('Tubod',                 'Lanao del Norte',         'PH'),
  ('Nabunturan',            'Davao de Oro',            'PH'),
  ('Malita',                'Davao Occidental',        'PH'),
  ('Alabel',                'Sarangani',               'PH'),
  ('Isulan',                'Sultan Kudarat',          'PH'),
  ('San Jose',              'Dinagat Islands',         'PH'),
  ('Jolo',                  'Sulu',                    'PH'),
  ('Bongao',                'Tawi-Tawi',               'PH'),
  ('Bangued',               'Abra',                    'PH'),
  ('Kabugao',               'Apayao',                  'PH'),
  ('La Trinidad',           'Benguet',                 'PH'),
  ('Lagawe',                'Ifugao',                  'PH'),
  ('Bontoc',                'Mountain Province',       'PH'),
  ('Datu Odin Sinsuat',     'Maguindanao del Norte',   'PH'),
  ('Buluan',                'Maguindanao del Sur',     'PH')
ON CONFLICT (name, state, country) DO NOTHING;

-- ============================================================
-- United States — every state capital plus each state's 1-3 largest
-- cities (skipping a duplicate row where the capital is also the largest)
-- ============================================================
INSERT INTO cities (name, state, country) VALUES
  ('Montgomery', 'AL', 'US'), ('Huntsville', 'AL', 'US'), ('Birmingham', 'AL', 'US'),
  ('Juneau', 'AK', 'US'), ('Anchorage', 'AK', 'US'), ('Fairbanks', 'AK', 'US'),
  ('Phoenix', 'AZ', 'US'), ('Tucson', 'AZ', 'US'), ('Mesa', 'AZ', 'US'),
  ('Little Rock', 'AR', 'US'), ('Fayetteville', 'AR', 'US'), ('Fort Smith', 'AR', 'US'),
  ('Sacramento', 'CA', 'US'), ('Los Angeles', 'CA', 'US'), ('San Diego', 'CA', 'US'), ('San Francisco', 'CA', 'US'),
  ('Denver', 'CO', 'US'), ('Colorado Springs', 'CO', 'US'), ('Aurora', 'CO', 'US'),
  ('Hartford', 'CT', 'US'), ('Bridgeport', 'CT', 'US'), ('New Haven', 'CT', 'US'),
  ('Dover', 'DE', 'US'), ('Wilmington', 'DE', 'US'),
  ('Tallahassee', 'FL', 'US'), ('Jacksonville', 'FL', 'US'), ('Miami', 'FL', 'US'), ('Tampa', 'FL', 'US'),
  ('Atlanta', 'GA', 'US'), ('Augusta', 'GA', 'US'), ('Columbus', 'GA', 'US'),
  ('Honolulu', 'HI', 'US'), ('Hilo', 'HI', 'US'),
  ('Boise', 'ID', 'US'), ('Meridian', 'ID', 'US'), ('Nampa', 'ID', 'US'),
  ('Springfield', 'IL', 'US'), ('Chicago', 'IL', 'US'), ('Aurora', 'IL', 'US'),
  ('Indianapolis', 'IN', 'US'), ('Fort Wayne', 'IN', 'US'), ('Evansville', 'IN', 'US'),
  ('Des Moines', 'IA', 'US'), ('Cedar Rapids', 'IA', 'US'), ('Davenport', 'IA', 'US'),
  ('Topeka', 'KS', 'US'), ('Wichita', 'KS', 'US'), ('Overland Park', 'KS', 'US'),
  ('Frankfort', 'KY', 'US'), ('Louisville', 'KY', 'US'), ('Lexington', 'KY', 'US'),
  ('Baton Rouge', 'LA', 'US'), ('New Orleans', 'LA', 'US'), ('Shreveport', 'LA', 'US'),
  ('Augusta', 'ME', 'US'), ('Portland', 'ME', 'US'), ('Lewiston', 'ME', 'US'),
  ('Annapolis', 'MD', 'US'), ('Baltimore', 'MD', 'US'),
  ('Boston', 'MA', 'US'), ('Worcester', 'MA', 'US'), ('Springfield', 'MA', 'US'),
  ('Lansing', 'MI', 'US'), ('Detroit', 'MI', 'US'), ('Grand Rapids', 'MI', 'US'),
  ('St. Paul', 'MN', 'US'), ('Minneapolis', 'MN', 'US'), ('Rochester', 'MN', 'US'),
  ('Jackson', 'MS', 'US'), ('Gulfport', 'MS', 'US'), ('Southaven', 'MS', 'US'),
  ('Jefferson City', 'MO', 'US'), ('Kansas City', 'MO', 'US'), ('St. Louis', 'MO', 'US'),
  ('Helena', 'MT', 'US'), ('Billings', 'MT', 'US'), ('Missoula', 'MT', 'US'),
  ('Lincoln', 'NE', 'US'), ('Omaha', 'NE', 'US'),
  ('Carson City', 'NV', 'US'), ('Las Vegas', 'NV', 'US'), ('Henderson', 'NV', 'US'),
  ('Concord', 'NH', 'US'), ('Manchester', 'NH', 'US'), ('Nashua', 'NH', 'US'),
  ('Trenton', 'NJ', 'US'), ('Newark', 'NJ', 'US'), ('Jersey City', 'NJ', 'US'),
  ('Santa Fe', 'NM', 'US'), ('Albuquerque', 'NM', 'US'), ('Las Cruces', 'NM', 'US'),
  ('Albany', 'NY', 'US'), ('New York City', 'NY', 'US'), ('Buffalo', 'NY', 'US'), ('Rochester', 'NY', 'US'),
  ('Raleigh', 'NC', 'US'), ('Charlotte', 'NC', 'US'), ('Greensboro', 'NC', 'US'),
  ('Bismarck', 'ND', 'US'), ('Fargo', 'ND', 'US'), ('Grand Forks', 'ND', 'US'),
  ('Columbus', 'OH', 'US'), ('Cleveland', 'OH', 'US'), ('Cincinnati', 'OH', 'US'),
  ('Oklahoma City', 'OK', 'US'), ('Tulsa', 'OK', 'US'), ('Norman', 'OK', 'US'),
  ('Salem', 'OR', 'US'), ('Portland', 'OR', 'US'), ('Eugene', 'OR', 'US'),
  ('Harrisburg', 'PA', 'US'), ('Philadelphia', 'PA', 'US'), ('Pittsburgh', 'PA', 'US'),
  ('Providence', 'RI', 'US'), ('Cranston', 'RI', 'US'), ('Warwick', 'RI', 'US'),
  ('Columbia', 'SC', 'US'), ('Charleston', 'SC', 'US'), ('North Charleston', 'SC', 'US'),
  ('Pierre', 'SD', 'US'), ('Sioux Falls', 'SD', 'US'), ('Rapid City', 'SD', 'US'),
  ('Nashville', 'TN', 'US'), ('Memphis', 'TN', 'US'), ('Knoxville', 'TN', 'US'),
  ('Austin', 'TX', 'US'), ('Houston', 'TX', 'US'), ('San Antonio', 'TX', 'US'), ('Dallas', 'TX', 'US'),
  ('Salt Lake City', 'UT', 'US'), ('West Valley City', 'UT', 'US'), ('Provo', 'UT', 'US'),
  ('Montpelier', 'VT', 'US'), ('Burlington', 'VT', 'US'),
  ('Richmond', 'VA', 'US'), ('Virginia Beach', 'VA', 'US'), ('Norfolk', 'VA', 'US'),
  ('Olympia', 'WA', 'US'), ('Seattle', 'WA', 'US'), ('Spokane', 'WA', 'US'),
  ('Charleston', 'WV', 'US'), ('Huntington', 'WV', 'US'), ('Morgantown', 'WV', 'US'),
  ('Madison', 'WI', 'US'), ('Milwaukee', 'WI', 'US'), ('Green Bay', 'WI', 'US'),
  ('Cheyenne', 'WY', 'US'), ('Casper', 'WY', 'US')
ON CONFLICT (name, state, country) DO NOTHING;

-- ============================================================
-- Australia — every state/territory capital plus several major cities
-- ============================================================
INSERT INTO cities (name, state, country) VALUES
  ('Sydney', 'NSW', 'AU'), ('Newcastle', 'NSW', 'AU'), ('Wollongong', 'NSW', 'AU'),
  ('Melbourne', 'VIC', 'AU'), ('Geelong', 'VIC', 'AU'), ('Ballarat', 'VIC', 'AU'), ('Bendigo', 'VIC', 'AU'),
  ('Brisbane', 'QLD', 'AU'), ('Gold Coast', 'QLD', 'AU'), ('Cairns', 'QLD', 'AU'), ('Townsville', 'QLD', 'AU'),
  ('Perth', 'WA', 'AU'), ('Fremantle', 'WA', 'AU'), ('Mandurah', 'WA', 'AU'), ('Bunbury', 'WA', 'AU'),
  ('Adelaide', 'SA', 'AU'), ('Mount Gambier', 'SA', 'AU'), ('Whyalla', 'SA', 'AU'),
  ('Hobart', 'TAS', 'AU'), ('Launceston', 'TAS', 'AU'), ('Devonport', 'TAS', 'AU'),
  ('Darwin', 'NT', 'AU'), ('Alice Springs', 'NT', 'AU'), ('Palmerston', 'NT', 'AU'),
  ('Canberra', 'ACT', 'AU')
ON CONFLICT (name, state, country) DO NOTHING;
