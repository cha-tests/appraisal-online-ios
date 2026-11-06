-- requested_broker_count (migration 026) had no upper bound at all — a
-- homeowner (or any other client writing to this table directly, bypassing
-- broker-optins.tsx's own 5-max validation) could request routing to an
-- unlimited number of brokers. Caps it at the database level too, matching
-- the MAX_REQUESTED_BROKERS limit now enforced client-side: enough for a
-- homeowner to compare real offers, far short of being swarmed by a crowd
-- of brokers. NULL stays valid — reports that never opted into broker
-- contact never set this column.

ALTER TABLE reports
  ADD CONSTRAINT reports_requested_broker_count_range
  CHECK (requested_broker_count IS NULL OR requested_broker_count BETWEEN 1 AND 5);
