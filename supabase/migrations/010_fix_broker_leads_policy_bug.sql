-- The original "Brokers can view assigned leads" policy (001_initial_schema.sql)
-- reads:
--
--   EXISTS (SELECT 1 FROM lead_routings WHERE lead_id = id AND broker_id = auth.uid())
--
-- The bare `id` was meant to mean "this lead's id" (leads.id, the outer row
-- being checked). But lead_routings has its own `id` primary key column, and
-- Postgres resolves an unqualified column name to the closest enclosing
-- scope — so `id` here resolved to lead_routings.id, not leads.id. Confirmed
-- live via pg_policies: the stored qual is literally
-- `lead_routings.lead_id = lead_routings.id`, comparing a routing row's
-- foreign key to its own primary key. Since a random UUID essentially never
-- equals another random UUID, this was false for every real row — so no
-- broker has ever been able to see an assigned lead, since the very first
-- migration, independent of anything about routing itself being correct.
--
-- The fix is only to qualify the reference so it can't be ambiguous.
ALTER POLICY "Brokers can view assigned leads" ON leads
  USING (
    EXISTS (
      SELECT 1 FROM lead_routings
      WHERE lead_routings.lead_id = leads.id
        AND lead_routings.broker_id = auth.uid()
    )
  );

-- Diagnostic-only function added to inspect this; no longer needed.
DROP FUNCTION IF EXISTS debug_list_policies(TEXT[]);
