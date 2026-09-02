/**
 * Permanently deletes ONE account entirely — the public.users row (cascades
 * to properties, reports, leads, broker_profiles, subscriptions,
 * lead_routings, refund_log), its report_allowance row, and the matching
 * auth.users login. Unlike scripts/reset-test-account.ts, which clears data
 * but keeps the login usable, this removes the account itself — the email
 * becomes available for a fresh signup afterward.
 *
 * Usage:
 *   cd appraisal-online-ios
 *   npx tsx scripts/delete-test-account.ts <email>
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

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: npx tsx scripts/delete-test-account.ts <email>');
    process.exit(1);
  }

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, email')
    .eq('email', email)
    .single();

  if (userError || !user) {
    console.error(`User not found for email "${email}":`, userError?.message);
    process.exit(1);
  }

  console.log(`Deleting account: ${user.email} (${user.id})`);

  const { error: deleteError, count } = await supabase
    .from('users')
    .delete({ count: 'exact' })
    .eq('id', user.id);

  if (deleteError) throw deleteError;
  console.log(`Deleted ${count} row from public.users (cascaded to properties/reports/leads/etc).`);

  const { error: allowanceError, count: allowanceCount } = await supabase
    .from('report_allowance')
    .delete({ count: 'exact' })
    .eq('user_id', user.id);

  if (allowanceError) throw allowanceError;
  console.log(`Deleted ${allowanceCount ?? 0} row(s) from report_allowance.`);

  const { error: authError } = await supabase.auth.admin.deleteUser(user.id);
  if (authError) {
    console.error('Failed to delete auth login:', authError.message);
    process.exit(1);
  }
  console.log('Deleted auth login — this email can sign up fresh now.');

  console.log('\nDone. Account fully deleted.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
