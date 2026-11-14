-- Fixes a serious bug in the free-tier monthly report cap (CLAUDE.md:
-- "3 consumer reports per calendar month, resetting on the 1st"): the
-- free-report counter silently stops being enforced for any homeowner
-- after their SECOND calendar month of using the app, letting them
-- generate unlimited free reports from then on. A real user's account
-- surfaced this (Your Account screen showing "0 used / 3 remaining" with
-- two reports already generated that same month).
--
-- Root cause: 001_initial_schema.sql gave report_allowance a plain
-- `UNIQUE` constraint on `user_id` alone, not on `(user_id, month)` —
-- meaning a user can only ever have ONE row in this table, period, no
-- matter how many months pass. increment_report_usage's
-- `ON CONFLICT (user_id)` matches that same (wrong) constraint, so:
--
--   1. A user's first-ever report creates one row, e.g. (user, Sep 1, 1).
--   2. Every later report, in ANY month, hits that same row via
--      ON CONFLICT (user_id) and just increments reports_used — the
--      `month` column is never updated, so it stays frozen at Sep 1
--      forever.
--   3. checkReportAllowance's query filters on
--      `WHERE user_id = ... AND month = <this month's 1st>`. Once the
--      calendar moves past that frozen month, this query can never match
--      the row again, returns "no record found", and the app treats that
--      as "full 3/3 allowance" — for every month after the user's first.
--
-- Verified by reproducing this exact sequence against a local replay of
-- every migration through 032: incrementing usage for Sep, then twice for
-- Nov, left a single row stuck at month=Sep with reports_used=3, and the
-- Nov-filtered query (what checkReportAllowance actually runs) returned
-- zero rows — i.e. "0 used, 3 remaining" despite 2 real reports that month.

-- 1. Fix the constraint so a user can have one row PER MONTH, matching
--    what the table was always meant to track.
ALTER TABLE report_allowance DROP CONSTRAINT IF EXISTS report_allowance_user_id_key;
ALTER TABLE report_allowance ADD CONSTRAINT report_allowance_user_id_month_key UNIQUE (user_id, month);

-- 2. Fix the function to conflict on the same (now correct) pair, so a
--    new calendar month gets its own row instead of overwriting the
--    previous month's.
CREATE OR REPLACE FUNCTION increment_report_usage(user_id_param UUID, report_month DATE)
RETURNS INTEGER AS $$
DECLARE
  current_usage INTEGER;
BEGIN
  INSERT INTO report_allowance (user_id, month, reports_used)
  VALUES (user_id_param, report_month, 1)
  ON CONFLICT (user_id, month) DO UPDATE
  SET reports_used = report_allowance.reports_used + 1,
      updated_at = now()
  RETURNING reports_used INTO current_usage;

  RETURN current_usage;
END;
$$ LANGUAGE plpgsql;

-- 3. Repair existing data. Every row currently in report_allowance is
--    potentially wrong (frozen at a stale month, with reports_used
--    accumulated across every month since) — there is no way to recover
--    which portion of a row's count belongs to which month from the
--    corrupted row alone. Recompute from the source of truth (`reports`,
--    which was never affected by this bug) instead: replace the whole
--    table with one row per user per calendar month that actually has
--    reports, counted directly.
TRUNCATE report_allowance;

INSERT INTO report_allowance (user_id, month, reports_used)
SELECT
  user_id,
  date_trunc('month', created_at)::date AS month,
  COUNT(*) AS reports_used
FROM reports
GROUP BY user_id, date_trunc('month', created_at)::date;
