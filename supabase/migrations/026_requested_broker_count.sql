-- How many professionals a consumer wants to connect with, asked
-- alongside the broker opt-in (see broker-optins.tsx) — required in the
-- UI whenever they opt in, but nullable here since existing rows and
-- declined reports never set it.

ALTER TABLE reports
  ADD COLUMN requested_broker_count INTEGER;
