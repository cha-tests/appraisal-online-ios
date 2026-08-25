/**
 * Creates two broker test accounts for manual QA:
 *   - a "free" broker: signed up and completed onboarding (has a
 *     broker_profiles row), but never paid — no subscriptions row. This is
 *     the state auth/login.tsx sends straight to /broker/dashboard (it only
 *     checks broker_profiles existence, not subscription status), so it's
 *     useful for testing what an unpaid broker can still see/do.
 *   - a "paid" broker: same, plus an active subscriptions row, for testing
 *     paid-only features.
 *
 * Idempotent: safe to re-run. Skips auth-user creation if the email already
 * exists, and upserts profile/subscription rows either way.
 *
 * Usage:
 *   cd appraisal-online-ios
 *   npx tsx scripts/create-broker-test-accounts.ts
 *
 * Reads SUPABASE_URL / SUPABASE_SERVICE_KEY from backend/.env.local.
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

interface AccountSpec {
  email: string;
  fullName: string;
  companyName: string;
  tier: 'Founder Lifetime' | 'Premium Annual' | 'Basic Annual';
  paid: boolean;
}

const ACCOUNTS: AccountSpec[] = [
  {
    email: 'testbroker.free@appraisalonline.ai',
    fullName: 'Test Broker (Free)',
    companyName: 'Free Tier Realty',
    tier: 'Basic Annual',
    paid: false,
  },
  {
    email: 'testbroker.paid@appraisalonline.ai',
    fullName: 'Test Broker (Paid)',
    companyName: 'Paid Tier Realty',
    tier: 'Premium Annual',
    paid: true,
  },
];

async function getOrCreateUser(spec: AccountSpec): Promise<string> {
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('email', spec.email)
    .maybeSingle();

  if (existing) {
    console.log(`  users row already exists (${existing.id})`);
    return existing.id;
  }

  const { data: created, error } = await supabase.auth.admin.createUser({
    email: spec.email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { user_type: 'broker', full_name: spec.fullName },
  });

  if (error || !created.user) {
    throw new Error(`Failed to create auth user for ${spec.email}: ${error?.message}`);
  }

  // migration 005's trigger inserts the matching public.users row
  // synchronously as part of the same transaction, so it should already be
  // visible — but confirm rather than assume, since this project's
  // migrations aren't always applied to the live DB (see project memory).
  const { data: row } = await supabase
    .from('users')
    .select('id')
    .eq('id', created.user.id)
    .maybeSingle();

  if (!row) {
    console.log('  public.users trigger did not fire — inserting manually');
    const { error: insertError } = await supabase.from('users').insert({
      id: created.user.id,
      email: spec.email,
      user_type: 'broker',
      full_name: spec.fullName,
    });
    if (insertError) throw new Error(`Failed to insert users row: ${insertError.message}`);
  }

  console.log(`  created auth user + users row (${created.user.id})`);
  return created.user.id;
}

async function upsertBrokerProfile(userId: string, spec: AccountSpec, cityId: string) {
  const { data: existing } = await supabase
    .from('broker_profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    console.log('  broker_profiles row already exists, leaving as-is');
    return;
  }

  const { error } = await supabase.from('broker_profiles').insert({
    user_id: userId,
    company_name: spec.companyName,
    license_number: 'TEST-000000',
    bio: `Test broker account (${spec.paid ? 'paid' : 'free'}) for app testing.`,
    phone: '512-555-0100',
    tier: spec.tier,
    selected_cities: [cityId],
    email_enabled: true,
    push_enabled: true,
    sms_enabled: spec.tier === 'Founder Lifetime',
  });

  if (error) throw new Error(`Failed to create broker_profiles row: ${error.message}`);
  console.log('  created broker_profiles row');
}

async function upsertSubscription(userId: string, spec: AccountSpec) {
  const { data: existing } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('broker_id', userId)
    .maybeSingle();

  if (existing) {
    console.log('  subscriptions row already exists, leaving as-is');
    return;
  }

  if (!spec.paid) {
    console.log('  no subscription created (this is the free account)');
    return;
  }

  const startedAt = new Date();
  const refundEligibleUntil = new Date(startedAt);
  refundEligibleUntil.setDate(refundEligibleUntil.getDate() + 30);
  const renewalAt = new Date(startedAt);
  renewalAt.setFullYear(renewalAt.getFullYear() + 1);

  const TIER_PRICE_CENTS: Record<AccountSpec['tier'], number> = {
    'Founder Lifetime': 49900,
    'Premium Annual': 19900,
    'Basic Annual': 4900,
  };

  const { error } = await supabase.from('subscriptions').insert({
    broker_id: userId,
    stripe_customer_id: `test_cus_${userId.slice(0, 8)}`,
    stripe_subscription_id: `test_sub_${userId.slice(0, 8)}`,
    tier: spec.tier,
    price: TIER_PRICE_CENTS[spec.tier],
    currency: 'USD',
    billing_cycle: spec.tier === 'Founder Lifetime' ? 'lifetime' : 'annual',
    started_at: startedAt.toISOString(),
    renewal_at: spec.tier === 'Founder Lifetime' ? null : renewalAt.toISOString(),
    refund_eligible_until: refundEligibleUntil.toISOString(),
    status: 'active',
  });

  if (error) throw new Error(`Failed to create subscriptions row: ${error.message}`);
  console.log('  created active subscriptions row');
}

async function main() {
  const { data: city, error: cityError } = await supabase
    .from('cities')
    .select('id')
    .limit(1)
    .single();

  if (cityError || !city) {
    console.error('Could not find a seeded city to assign — run the city seed migration first.');
    process.exit(1);
  }

  for (const spec of ACCOUNTS) {
    console.log(`\n${spec.email}:`);
    const userId = await getOrCreateUser(spec);
    await upsertBrokerProfile(userId, spec, city.id);
    await upsertSubscription(userId, spec);
  }

  console.log('\nDone.\n');
  console.log('Login credentials (password is the same for both):');
  for (const spec of ACCOUNTS) {
    console.log(`  ${spec.email} / ${PASSWORD}  ${spec.paid ? '(paid)' : '(free/unpaid)'}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
