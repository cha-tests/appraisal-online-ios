-- Removes the hard 5-max cap migration 035 added to
-- reports.requested_broker_count — MVP decision: trust the homeowner rather
-- than block them. broker-optins.tsx now double-checks with a confirm
-- dialog above 10 instead of refusing the number outright, so the database
-- only needs to keep guarding against nonsensical values (zero, negative),
-- not impose a business-chosen ceiling.

ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_requested_broker_count_range;

ALTER TABLE reports
  ADD CONSTRAINT reports_requested_broker_count_positive
  CHECK (requested_broker_count IS NULL OR requested_broker_count >= 1);
