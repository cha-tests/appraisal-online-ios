/**
 * Wipes ALL user-generated data: every row in `users` (which cascades via
 * ON DELETE CASCADE to properties, reports, leads, broker_profiles,
 * subscriptions, lead_routings, and refund_log — see
 * supabase/migrations/001_initial_schema.sql) plus report_allowance, and
 * every corresponding auth.users entry (deleting public.users does not
 * remove the auth account, so without this step the same emails could
 * never sign up again).
 *
 * Does NOT touch reference/seed data — `cities` and `marketing_allocations`
 * are left intact, since those aren't user data and broker onboarding
 * depends on `cities` existing.
 *
 * Usage:
 *   cd appraisal-online-ios
 *   npx tsx scripts/reset-all-data.ts --confirm
 *
 * The --confirm flag is required so this can't be run by accident.
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

if (!process.argv.includes('--confirm')) {
  console.error('This deletes ALL users and everything they created. Re-run with --confirm to proceed.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  const { data: users, error: usersError } = await supabase.from('users').select('id, email');
  if (usersError) throw usersError;

  console.log(`Found ${users.length} user(s).`);

  if (users.length === 0) {
    console.log('Nothing to delete.');
    return;
  }

  // Deleting the public.users rows cascades to properties, reports, leads,
  // broker_profiles, subscriptions, lead_routings, and refund_log.
  const { error: deleteUsersError, count } = await supabase
    .from('users')
    .delete({ count: 'exact' })
    .in('id', users.map((u) => u.id));

  if (deleteUsersError) throw deleteUsersError;
  console.log(`Deleted ${count} row(s) from public.users (cascaded to dependent tables).`);

  // report_allowance has no FK to users with ON DELETE CASCADE (it's keyed
  // by user_id but that's a plain UUID column, not a declared reference in
  // the schema this project actually has live) — clear it explicitly too.
  const { error: allowanceError, count: allowanceCount } = await supabase
    .from('report_allowance')
    .delete({ count: 'exact' })
    .in('user_id', users.map((u) => u.id));

  if (allowanceError) throw allowanceError;
  console.log(`Deleted ${allowanceCount ?? 0} row(s) from report_allowance.`);

  // Now remove the actual login credentials — deleting public.users never
  // touches auth.users, so without this the same emails could never sign
  // up again ("already registered").
  let authDeleted = 0;
  for (const user of users) {
    const { error } = await supabase.auth.admin.deleteUser(user.id);
    if (error) {
      console.error(`Failed to delete auth user ${user.email} (${user.id}):`, error.message);
    } else {
      authDeleted++;
    }
  }
  console.log(`Deleted ${authDeleted}/${users.length} auth account(s).`);

  console.log('\nDone. All user data wiped. Reference data (cities) left untouched.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
