-- Closes the gap CLAUDE.md's "Known gaps" section flags: migration 027 only
-- catches up an orphaned lead (one with zero lead_routings rows) when a
-- broker later touches their own city list — it does nothing for a lead
-- that's stuck *right now*, and nothing for one that gets stuck in the
-- future if no action happens to trigger 027's event. This adds both
-- missing pieces:
--
--   1. route_all_orphaned_leads() — the same routing logic as
--      route_lead_to_brokers (008, updated by 022) and
--      route_orphaned_leads_to_broker (027), but swept across every
--      orphaned lead and every active broker at once instead of one
--      lead or one broker at a time. Idempotent — NOT EXISTS against
--      lead_routings means running it twice never double-routes.
--   2. A one-time call to it below, so the backlog that already exists
--      gets cleared the moment this migration runs.
--   3. A pg_cron job so step 2 isn't a one-off — a lead that falls
--      through for any reason gets picked up within the hour, with no
--      broker action required.
--
-- pg_cron needs to be enabled for this Supabase project (Database >
-- Extensions in the dashboard, available on paid plans). If it isn't,
-- the function and the one-time backfill above still apply — only the
-- recurring part is skipped, with a NOTICE explaining the manual step.

CREATE OR REPLACE FUNCTION route_all_orphaned_leads()
RETURNS INTEGER AS $$
DECLARE
  routed_count INTEGER;
BEGIN
  INSERT INTO lead_routings (lead_id, broker_id, delivery_channel, digest_date)
  SELECT
    l.id,
    bp.user_id,
    CASE
      WHEN bp.email_enabled THEN 'email'
      WHEN bp.push_enabled THEN 'push'
      WHEN bp.sms_enabled THEN 'sms'
      ELSE 'email'
    END,
    CASE WHEN bp.tier = 'Basic Annual' THEN next_weekly_digest_date() ELSE NULL END
  FROM leads l
  JOIN broker_profiles bp ON bp.selected_cities @> ARRAY[l.city_id]
  JOIN subscriptions s ON s.broker_id = bp.user_id AND s.status = 'active'
  WHERE l.city_id IS NOT NULL
    AND l.status != 'archived'
    AND NOT EXISTS (SELECT 1 FROM lead_routings lr WHERE lr.lead_id = l.id);

  GET DIAGNOSTICS routed_count = ROW_COUNT;
  RETURN routed_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION route_all_orphaned_leads() TO authenticated;

-- One-time backfill: clear whatever's stuck today. Safe to re-run (see
-- idempotency note above), so this applying again on a future `db reset`
-- or redeploy is a harmless no-op.
SELECT route_all_orphaned_leads();

-- Recurring job — hourly, since this is a safety net for leads that fell
-- through the real-time/digest paths entirely, not the primary delivery
-- mechanism itself (that's still route_lead_to_brokers at opt-in time).
DO $$
BEGIN
  EXECUTE 'CREATE EXTENSION IF NOT EXISTS pg_cron';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron could not be enabled (%). Enable it via Supabase Dashboard > Database > Extensions on a plan that supports it, then run: SELECT cron.schedule(''route-orphaned-leads-hourly'', ''0 * * * *'', ''SELECT route_all_orphaned_leads();'');', SQLERRM;
END $$;

DO $$
BEGIN
  -- Unschedule first so re-running this migration (redeploy, db reset)
  -- doesn't fail on a duplicate job name.
  PERFORM cron.unschedule('route-orphaned-leads-hourly');
EXCEPTION WHEN OTHERS THEN
  NULL; -- nothing scheduled yet — fine
END $$;

DO $$
BEGIN
  PERFORM cron.schedule(
    'route-orphaned-leads-hourly',
    '0 * * * *',
    $cron$SELECT route_all_orphaned_leads();$cron$
  );
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not schedule the pg_cron job (%). If pg_cron is not enabled on this Supabase plan, enable it via Dashboard > Database > Extensions, then run: SELECT cron.schedule(''route-orphaned-leads-hourly'', ''0 * * * *'', ''SELECT route_all_orphaned_leads();'');', SQLERRM;
END $$;
