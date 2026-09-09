/**
 * Resets EVERY account's generated reports back to zero — deletes all
 * properties (cascading to reports and any leads created from those
 * reports, per the FK constraints in supabase/migrations/001_initial_schema.sql)
 * and clears every account's monthly report_allowance counter.
 *
 * Unlike reset-test-account.ts (one account by email), this applies to
 * every account in the database — user logins themselves are untouched,
 * only their generated report history and free-report quota.
 *
 * Usage:
 *   cd appraisal-online-ios
 *   npx tsx scripts/reset-all-reports.ts
 *
 * Reads SUPABASE_URL / SUPABASE_SERVICE_KEY from backend/.env.local — the
 * service role key is required since this bypasses row-level security to
 * delete every user's rows, not just the caller's own.
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../backend/.env.local') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in backend/.env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function resetAllReports() {
  const { count: propertiesBefore } = await supabase
    .from('properties')
    .select('*', { count: 'exact', head: true });
  const { count: reportsBefore } = await supabase
    .from('reports')
    .select('*', { count: 'exact', head: true });
  const { count: leadsBefore } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true });
  const { count: allowanceBefore } = await supabase
    .from('report_allowance')
    .select('*', { count: 'exact', head: true });

  console.log(
    `Before: ${propertiesBefore ?? 0} properties, ${reportsBefore ?? 0} reports, ` +
      `${leadsBefore ?? 0} leads, ${allowanceBefore ?? 0} report_allowance rows.`
  );

  // Deleting properties cascades to reports (properties.id -> reports.property_id
  // ON DELETE CASCADE) and from there to leads (reports.id -> leads.report_id
  // ON DELETE CASCADE) — matches reset-test-account.ts, applied to every user
  // by not filtering on user_id. `.gte('id', ...)` is a required non-empty
  // filter for Supabase's delete API — this uuid is below any real uuid, so
  // it matches every row.
  const { error: propertiesError, count: propertiesDeleted } = await supabase
    .from('properties')
    .delete({ count: 'exact' })
    .gte('id', '00000000-0000-0000-0000-000000000000');

  if (propertiesError) {
    console.error('Failed to delete properties:', propertiesError.message);
    process.exit(1);
  }
  console.log(`Deleted ${propertiesDeleted ?? 0} propert(y/ies) (reports and leads cascaded).`);

  const { error: allowanceError, count: allowanceDeleted } = await supabase
    .from('report_allowance')
    .delete({ count: 'exact' })
    .gte('user_id', '00000000-0000-0000-0000-000000000000');

  if (allowanceError) {
    console.error('Failed to clear report_allowance:', allowanceError.message);
    process.exit(1);
  }
  console.log(`Cleared ${allowanceDeleted ?? 0} report_allowance row(s) — every account gets a fresh 3/month.`);

  console.log('Done. Every account is reset to zero generated reports.');
}

resetAllReports();
