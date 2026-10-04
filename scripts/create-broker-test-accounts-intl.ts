/**
 * Creates five paid-tier broker test accounts, one based in each of:
 * US, Philippines, Australia, UK, Singapore — for QA on international
 * broker onboarding/lead-routing before those markets are formally launched
 * (CLAUDE.md currently documents US + PH only; AU/GB/SG city rows don't
 * exist yet, so this script seeds one representative city per country,
 * matching the cities already used in TEST_MARKET_SCENARIOS.md).
 *
 * All five get tier 'Premium Annual' with an active subscriptions row
 * (mirrors the "paid" example in create-broker-test-accounts.ts).
 *
 * Idempotent: safe to re-run. Skips auth-user creation if the email already
 * exists, and skips city/profile/subscription rows that already exist.
 *
 * Usage:
 *   cd appraisal-online-ios
 *   npx tsx scripts/create-broker-test-accounts-intl.ts
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
const TIER = 'Premium Annual' as const;
const TIER_PRICE_CENTS = 19900;

interface CountrySpec {
  country: string; // ISO code, matching marketConfig.ts / TEST_MARKET_SCENARIOS.md
  cityName: string;
  cityState: string; // subnational unit, or the country/city-state name for city-states
  email: string;
  companyName: string;
}

const COUNTRIES: CountrySpec[] = [
  { country: 'US', cityName: 'San Francisco', cityState: 'CA', email: 'testbroker.us@appraisalonline.ai', companyName: 'US Test Realty' },
  { country: 'PH', cityName: 'Manila', cityState: 'Metro Manila', email: 'testbroker.ph@appraisalonline.ai', companyName: 'PH Test Realty' },
  { country: 'AU', cityName: 'Sydney', cityState: 'New South Wales', email: 'testbroker.au@appraisalonline.ai', companyName: 'AU Test Realty' },
  { country: 'GB', cityName: 'London', cityState: 'England', email: 'testbroker.gb@appraisalonline.ai', companyName: 'UK Test Realty' },
  { country: 'SG', cityName: 'Singapore', cityState: 'Singapore', email: 'testbroker.sg@appraisalonline.ai', companyName: 'SG Test Realty' },
];

async function getOrCreateCity(spec: CountrySpec): Promise<string> {
  const { data: existing } = await supabase
    .from('cities')
    .select('id')
    .eq('country', spec.country)
    .limit(1)
    .maybeSingle();

  if (existing) {
    console.log(`  using existing ${spec.country} city (${existing.id})`);
    return existing.id;
  }

  const { data: created, error } = await supabase
    .from('cities')
    .insert({ name: spec.cityName, state: spec.cityState, country: spec.country })
    .select('id')
    .single();

  if (error || !created) {
    throw new Error(`Failed to create city for ${spec.country}: ${error?.message}`);
  }

  console.log(`  seeded ${spec.cityName}, ${spec.cityState} (${spec.country}) as city ${created.id}`);
  return created.id;
}

async function getOrCreateUser(spec: CountrySpec): Promise<string> {
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
    user_metadata: { user_type: 'broker', first_name: 'Test', last_name: `Broker (${spec.country})` },
  });

  if (error || !created.user) {
    throw new Error(`Failed to create auth user for ${spec.email}: ${error?.message}`);
  }

  // migration 005's trigger inserts the matching public.users row
  // synchronously — but confirm rather than assume, since this project's
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
      first_name: 'Test',
      last_name: `Broker (${spec.country})`,
    });
    if (insertError) throw new Error(`Failed to insert users row: ${insertError.message}`);
  }

  console.log(`  created auth user + users row (${created.user.id})`);
  return created.user.id;
}

async function upsertBrokerProfile(userId: string, spec: CountrySpec, cityId: string) {
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
    bio: `Test broker account (paid, ${spec.country}) for international QA.`,
    phone: '512-555-0100',
    tier: TIER,
    selected_cities: [cityId],
    email_enabled: true,
    push_enabled: true,
    sms_enabled: false,
  });

  if (error) throw new Error(`Failed to create broker_profiles row: ${error.message}`);
  console.log('  created broker_profiles row');
}

async function upsertSubscription(userId: string) {
  const { data: existing } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('broker_id', userId)
    .maybeSingle();

  if (existing) {
    console.log('  subscriptions row already exists, leaving as-is');
    return;
  }

  const startedAt = new Date();
  const refundEligibleUntil = new Date(startedAt);
  refundEligibleUntil.setDate(refundEligibleUntil.getDate() + 30);
  const renewalAt = new Date(startedAt);
  renewalAt.setFullYear(renewalAt.getFullYear() + 1);

  const { error } = await supabase.from('subscriptions').insert({
    broker_id: userId,
    stripe_customer_id: `test_cus_${userId.slice(0, 8)}`,
    stripe_subscription_id: `test_sub_${userId.slice(0, 8)}`,
    tier: TIER,
    price: TIER_PRICE_CENTS,
    currency: 'USD',
    billing_cycle: 'annual',
    started_at: startedAt.toISOString(),
    renewal_at: renewalAt.toISOString(),
    refund_eligible_until: refundEligibleUntil.toISOString(),
    status: 'active',
  });

  if (error) throw new Error(`Failed to create subscriptions row: ${error.message}`);
  console.log('  created active subscriptions row');
}

async function main() {
  for (const spec of COUNTRIES) {
    console.log(`\n${spec.country} — ${spec.email}:`);
    const cityId = await getOrCreateCity(spec);
    const userId = await getOrCreateUser(spec);
    await upsertBrokerProfile(userId, spec, cityId);
    await upsertSubscription(userId);
  }

  console.log('\nDone.\n');
  console.log('Login credentials (password is the same for all):');
  for (const spec of COUNTRIES) {
    console.log(`  ${spec.email} / ${PASSWORD}  (${spec.country}, ${TIER}, paid)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
