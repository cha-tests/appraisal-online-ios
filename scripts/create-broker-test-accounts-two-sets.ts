/**
 * Creates two sets of paid-tier (Premium Annual) broker test accounts, each
 * with one broker in PH, US, SG, AU and GB:
 *   - set "today": dated now
 *   - set "0920":  backdated to 2026-09-20 (public.users / broker_profiles
 *     created_at and the subscription start/renewal/refund dates). The
 *     auth.users created_at can't be set through the admin API, so that one
 *     field still shows the real creation time.
 *
 * Idempotent: re-running skips anything that already exists.
 *
 * Usage:
 *   cd appraisal-online-ios
 *   npx tsx scripts/create-broker-test-accounts-two-sets.ts
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

const PASSWORD = 'TestPass123!';
const TIER = 'Premium Annual' as const;
const TIER_PRICE_CENTS = 19900;
const COUNTRIES = ['PH', 'US', 'SG', 'AU', 'GB'];

interface SetSpec {
  label: string;
  emailTag: string;
  createdAt: Date;
}

const now = new Date();
const SETS: SetSpec[] = [
  { label: 'created today', emailTag: now.toISOString().slice(5, 10).replace('-', ''), createdAt: now },
  { label: 'created 20 Sep 2026', emailTag: '0920', createdAt: new Date('2026-09-20T09:00:00Z') },
];

async function cityFor(country: string): Promise<string> {
  const { data, error } = await supabase
    .from('cities')
    .select('id')
    .eq('country', country)
    .limit(1)
    .maybeSingle();
  if (error || !data) throw new Error(`No city found for ${country}`);
  return data.id;
}

async function createAccount(country: string, set: SetSpec) {
  const email = `${country.toLowerCase()}${set.emailTag}@aol.ai`;
  const stamp = set.createdAt.toISOString();
  console.log(`\n${email}:`);

  let userId: string;
  const { data: existing } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
  if (existing) {
    userId = existing.id;
    console.log(`  already exists (${userId})`);
  } else {
    const { data: created, error } = await supabase.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { user_type: 'broker', first_name: 'Test', last_name: `Broker (${country} ${set.emailTag})` },
    });
    if (error || !created.user) throw new Error(`createUser ${email}: ${error?.message}`);
    userId = created.user.id;

    const { data: row } = await supabase.from('users').select('id').eq('id', userId).maybeSingle();
    if (!row) {
      const { error: insErr } = await supabase.from('users').insert({
        id: userId,
        email,
        user_type: 'broker',
        first_name: 'Test',
        last_name: `Broker (${country} ${set.emailTag})`,
      });
      if (insErr) throw new Error(`insert users ${email}: ${insErr.message}`);
    }
    await supabase.from('users').update({ created_at: stamp }).eq('id', userId);
    console.log(`  created user (${userId})`);
  }

  const { data: prof } = await supabase.from('broker_profiles').select('id').eq('user_id', userId).maybeSingle();
  if (!prof) {
    const { error } = await supabase.from('broker_profiles').insert({
      user_id: userId,
      company_name: `${country} Test Realty (${set.emailTag})`,
      license_number: 'TEST-000000',
      bio: `Test broker (paid, ${country}), ${set.label}.`,
      phone: '512-555-0100',
      tier: TIER,
      selected_cities: [await cityFor(country)],
      email_enabled: true,
      push_enabled: true,
      sms_enabled: false,
      created_at: stamp,
    });
    if (error) throw new Error(`broker_profiles ${email}: ${error.message}`);
    console.log('  created broker profile');
  }

  const { data: sub } = await supabase.from('subscriptions').select('id').eq('broker_id', userId).maybeSingle();
  if (!sub) {
    const refund = new Date(set.createdAt);
    refund.setDate(refund.getDate() + 30);
    const renewal = new Date(set.createdAt);
    renewal.setFullYear(renewal.getFullYear() + 1);
    const { error } = await supabase.from('subscriptions').insert({
      broker_id: userId,
      stripe_customer_id: `test_cus_${userId.slice(0, 8)}`,
      stripe_subscription_id: `test_sub_${userId.slice(0, 8)}`,
      tier: TIER,
      price: TIER_PRICE_CENTS,
      currency: 'USD',
      billing_cycle: 'annual',
      started_at: stamp,
      renewal_at: renewal.toISOString(),
      refund_eligible_until: refund.toISOString(),
      status: 'active',
    });
    if (error) throw new Error(`subscriptions ${email}: ${error.message}`);
    console.log('  created active subscription');
  }
}

async function main() {
  for (const set of SETS) {
    console.log(`\n===== Set: ${set.label} =====`);
    for (const country of COUNTRIES) await createAccount(country, set);
  }
  console.log(`\nDone. Password for all: ${PASSWORD}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
