/**
 * Resets a consumer test account's report history so it can be reused for
 * repeated manual QA runs: deletes their properties (cascading to reports
 * and any leads created from those reports) and clears their monthly report
 * allowance counter.
 *
 * Usage:
 *   cd appraisal-online-ios
 *   npx tsx scripts/reset-test-account.ts testconsumer@appraisalonline.ai
 *
 * Reads SUPABASE_URL / SUPABASE_SERVICE_KEY from backend/.env.local — the
 * service role key is required since this bypasses row-level security to
 * delete another user's rows.
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

async function resetAccount(email: string) {
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, email')
    .eq('email', email)
    .single();

  if (userError || !user) {
    console.error(`User not found for email "${email}":`, userError?.message);
    process.exit(1);
  }

  console.log(`Resetting account: ${user.email} (${user.id})`);

  // Deleting properties cascades to reports (properties.id -> reports.property_id
  // ON DELETE CASCADE) and from there to leads (reports.id -> leads.report_id
  // ON DELETE CASCADE) — see supabase/migrations/001_initial_schema.sql.
  const { error: propertiesError, count: propertiesCount } = await supabase
    .from('properties')
    .delete({ count: 'exact' })
    .eq('user_id', user.id);

  if (propertiesError) {
    console.error('Failed to delete properties:', propertiesError.message);
    process.exit(1);
  }
  console.log(`Deleted ${propertiesCount ?? 0} propert(y/ies) (reports and leads cascaded).`);

  const { error: allowanceError, count: allowanceCount } = await supabase
    .from('report_allowance')
    .delete({ count: 'exact' })
    .eq('user_id', user.id);

  if (allowanceError) {
    console.error('Failed to reset report allowance:', allowanceError.message);
    process.exit(1);
  }
  console.log(`Cleared report_allowance row (${allowanceCount ?? 0} deleted) — next check gets a fresh 3/month.`);

  console.log('Done. Account is reset to a clean state.');
}

const email = process.argv[2];
if (!email) {
  console.error('Usage: npx tsx scripts/reset-test-account.ts <email>');
  process.exit(1);
}

resetAccount(email);
