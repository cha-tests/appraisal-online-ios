-- Lets a consumer revoke broker contact for a report they already opted in
-- on (see consumer/settings.tsx and report.service.ts's updateBrokerOptIn).
-- Revoking needs to do more than flip reports.broker_contact_opted_in back
-- to false — a lead may already exist and be routed to a broker, and
-- without this policy the consumer has no write access to that lead row at
-- all (001_initial_schema.sql only ever gave them SELECT), so there was no
-- way to actually pull it back out of a broker's inbox.
--
-- Scoped to UPDATE only (not DELETE) and only rows they own, matching the
-- existing "Consumers can view own leads" policy.
CREATE POLICY "Consumers can update own leads" ON leads
  FOR UPDATE USING (auth.uid() = consumer_id);
