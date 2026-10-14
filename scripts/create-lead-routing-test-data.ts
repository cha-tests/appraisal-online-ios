/**
 * Seeds data to see how lead routing actually behaves end to end:
 *   - 15 homeowner accounts (5 each in Pasig, Makati, Taguig), each with a
 *     real property + appraisal report, opted in to broker contact — which
 *     triggers the same lead-creation + route_lead_to_brokers() call the
 *     real app makes.
 *   - 6 broker accounts with deliberately mixed city selections (solo-city,
 *     partial overlap, full overlap, and a zero-overlap negative control),
 *     across all three tiers, so the digest-vs-real-time and per-tier
 *     routing logic is all exercised.
 *
 * "BCG" in the request is read as BGC (Bonifacio Global City) — that's a
 * district of Taguig, not its own seeded row in `cities`, so BGC-area
 * homeowners and the broker covering it are both tagged Taguig.
 *
 * Idempotent: re-running skips any user/property/lead that already exists.
 *
 * Usage:
 *   cd appraisal-online-ios
 *   npx tsx scripts/create-lead-routing-test-data.ts
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
const TARGET_CITIES = ['Pasig', 'Makati', 'Taguig'] as const;
const HOMEOWNERS_PER_CITY = 5;

const STREETS = [
  'Shaw Blvd', 'Ortigas Ave', 'Kalayaan Ave', 'Jupiter St', 'Chino Roces Ave',
  'McKinley Pkwy', 'Bonifacio High Street', 'C5 Rd', 'Meralco Ave', 'E. Rodriguez Jr. Ave',
];
const PROPERTY_TYPES = ['Condo', 'House', 'Townhouse', 'Apartment/Unit'];
const CONDITIONS = ['Excellent', 'Good', 'Fair', 'Poor'];

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick<T>(arr: readonly T[]): T {
  return arr[randomInt(0, arr.length - 1)];
}

async function cityId(name: string): Promise<string> {
  const { data, error } = await supabase.from('cities').select('id').eq('country', 'PH').eq('name', name).maybeSingle();
  if (error || !data) throw new Error(`City not seeded: ${name}`);
  return data.id;
}

async function ensureUser(
  email: string,
  userType: 'consumer' | 'broker',
  firstName: string,
  lastName: string,
  phone?: string
): Promise<string> {
  const { data: existing } = await supabase.from('users').select('id').eq('email', email).maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await supabase.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { user_type: userType, first_name: firstName, last_name: lastName, phone: phone || undefined },
  });
  if (error || !created.user) throw new Error(`createUser ${email}: ${error?.message}`);
  const userId = created.user.id;

  const { data: row } = await supabase.from('users').select('id').eq('id', userId).maybeSingle();
  if (!row) {
    const { error: insErr } = await supabase
      .from('users')
      .insert({ id: userId, email, user_type: userType, first_name: firstName, last_name: lastName, phone: phone || null });
    if (insErr) throw new Error(`insert users ${email}: ${insErr.message}`);
  }
  return userId;
}

// ---------------------------------------------------------------------
// Homeowners: property + report + broker opt-in (-> lead -> routing)
// ---------------------------------------------------------------------

async function createHomeowner(city: string, index: number) {
  const slug = city.toLowerCase();
  const email = `homeowner-${slug}-${index}@aol.ai`;
  console.log(`\n${email} (${city}):`);

  const phone = `09${randomInt(150000000, 999999999)}`;
  const userId = await ensureUser(email, 'consumer', 'Test', `Homeowner ${slug}-${index}`, phone);

  const { data: existingProperty } = await supabase
    .from('properties')
    .select('id, reports:reports(id)')
    .eq('user_id', userId)
    .maybeSingle();
  if (existingProperty) {
    console.log(`  already has a property + report — skipping`);
    return;
  }

  const streetNum = randomInt(1, 400);
  const street = pick(STREETS);
  const address = `${streetNum} ${street}, ${city}, Metro Manila, Philippines`;

  const { data: property, error: propErr } = await supabase
    .from('properties')
    .insert({
      user_id: userId,
      address,
      address_components: {
        street_number: String(streetNum),
        route: street,
        barangay: `Barangay ${randomInt(1, 50)}`,
        city,
        province: 'Metro Manila',
        country: 'Philippines',
        country_code: 'PH',
        is_precise: true,
      },
      bedrooms: randomInt(1, 5),
      bathrooms: randomInt(1, 4),
      square_feet: randomInt(35, 300),
      lot_size: randomInt(0, 400),
      year_built: randomInt(1995, 2024),
      property_type: pick(PROPERTY_TYPES),
      condition: pick(CONDITIONS),
    })
    .select()
    .single();
  if (propErr) throw new Error(`properties ${email}: ${propErr.message}`);
  console.log(`  property: ${address}`);

  // Minor units (centavos) — matches formatCurrency's convention. A random,
  // plausible Metro Manila valuation: PHP 3M-15M.
  const estimatedValue = randomInt(3_000_000, 15_000_000) * 100;
  const low = Math.round(estimatedValue * 0.9);
  const high = Math.round(estimatedValue * 1.1);

  const { data: report, error: reportErr } = await supabase
    .from('reports')
    .insert({
      user_id: userId,
      property_id: property.id,
      estimated_value: estimatedValue,
      confidence_range: { low, high },
      comparables: [
        {
          address: `${randomInt(1, 400)} ${pick(STREETS)}, ${city}, Metro Manila`,
          sale_price: Math.round(estimatedValue * (0.9 + Math.random() * 0.2)),
          sale_date: '2026-07-15',
          distance_miles: Math.round(Math.random() * 10 * 10) / 10,
          similarity_score: Math.round((0.8 + Math.random() * 0.2) * 100) / 100,
        },
      ],
      broker_contact_opted_in: true,
      phone_provided: phone,
      phone_verified: false,
      is_owner: true,
      intends_to_sell: Math.random() > 0.5,
      status: 'generated',
    })
    .select()
    .single();
  if (reportErr) throw new Error(`reports ${email}: ${reportErr.message}`);
  console.log(`  report: PHP ${(estimatedValue / 100).toLocaleString()} — opted in to broker contact`);

  const targetCityId = await cityId(city);
  const { data: lead, error: leadErr } = await supabase
    .from('leads')
    .insert({
      report_id: report.id,
      property_id: property.id,
      consumer_id: userId,
      consumer_email: email,
      consumer_phone: phone,
      property_address: address,
      property_value: estimatedValue,
      city_id: targetCityId,
    })
    .select()
    .single();
  if (leadErr) throw new Error(`leads ${email}: ${leadErr.message}`);

  const { data: routedCount, error: routeErr } = await supabase.rpc('route_lead_to_brokers', {
    p_lead_id: lead.id,
    p_city_id: targetCityId,
  });
  if (routeErr) throw new Error(`route_lead_to_brokers ${email}: ${routeErr.message}`);
  console.log(`  lead routed to ${routedCount ?? 0} broker(s)`);
}

// ---------------------------------------------------------------------
// Brokers: deliberately mixed city coverage of the three target cities
// ---------------------------------------------------------------------

interface BrokerSpec {
  email: string;
  label: string;
  tier: 'Basic Annual' | 'Premium Annual' | 'Founder Lifetime';
  cities: string[]; // city names; resolved to ids below
  coverageNote: string;
}

const BROKER_SPECS: BrokerSpec[] = [
  { email: 'broker-pasig-only@aol.ai', label: 'Pasig Only Realty', tier: 'Basic Annual', cities: ['Pasig'], coverageNote: 'Pasig only' },
  { email: 'broker-makati-only@aol.ai', label: 'Makati Only Realty', tier: 'Basic Annual', cities: ['Makati'], coverageNote: 'Makati only' },
  { email: 'broker-bgc-only@aol.ai', label: 'BGC Only Realty', tier: 'Basic Annual', cities: ['Taguig'], coverageNote: 'Taguig/BGC only' },
  {
    email: 'broker-mixed-2of3@aol.ai',
    label: 'Partial Coverage Realty',
    tier: 'Premium Annual',
    cities: ['Makati', 'Taguig', 'Quezon City'],
    coverageNote: 'Makati + Taguig/BGC (Pasig excluded)',
  },
  {
    email: 'broker-all3@aol.ai',
    label: 'Full Coverage Realty',
    tier: 'Founder Lifetime',
    cities: ['Pasig', 'Makati', 'Taguig', 'Manila', 'Mandaluyong'],
    coverageNote: 'Pasig + Makati + Taguig/BGC (all three)',
  },
  {
    email: 'broker-none@aol.ai',
    label: 'Elsewhere Realty',
    tier: 'Premium Annual',
    cities: ['Cebu City', 'Davao City', 'Baguio'],
    coverageNote: 'none of the three — negative control',
  },
];

const TIER_PRICE_CENTS: Record<BrokerSpec['tier'], number> = {
  'Founder Lifetime': 49900,
  'Premium Annual': 19900,
  'Basic Annual': 4900,
};
const TIER_REFUND_DAYS: Record<BrokerSpec['tier'], number> = {
  'Founder Lifetime': 14,
  'Premium Annual': 30,
  'Basic Annual': 30,
};

async function createBroker(spec: BrokerSpec) {
  console.log(`\n${spec.email} (${spec.coverageNote}):`);
  const userId = await ensureUser(spec.email, 'broker', 'Test', spec.label, '09171234567');

  const { data: existingProfile } = await supabase.from('broker_profiles').select('id').eq('user_id', userId).maybeSingle();
  if (existingProfile) {
    console.log('  broker profile already exists — skipping');
    return;
  }

  const cityIds = await Promise.all(spec.cities.map(cityId));

  const { error: profErr } = await supabase.from('broker_profiles').insert({
    user_id: userId,
    company_name: spec.label,
    license_number: 'TEST-000000',
    bio: `Test broker — ${spec.coverageNote}.`,
    phone: '09171234567',
    tier: spec.tier,
    selected_cities: cityIds,
    email_enabled: true,
    // Basic Annual is email-only, weekly digest; Premium/Founder get
    // real-time push too; Founder adds SMS — matches CLAUDE.md's tiers table.
    push_enabled: spec.tier !== 'Basic Annual',
    sms_enabled: spec.tier === 'Founder Lifetime',
    kyc_status: 'approved',
    kyc_reviewed_at: new Date().toISOString(),
  });
  if (profErr) throw new Error(`broker_profiles ${spec.email}: ${profErr.message}`);
  console.log(`  profile: ${spec.tier}, cities = ${spec.cities.join(', ')}`);

  const now = new Date();
  const refund = new Date(now);
  refund.setDate(refund.getDate() + TIER_REFUND_DAYS[spec.tier]);
  const renewal = new Date(now);
  renewal.setFullYear(renewal.getFullYear() + 1);

  const { error: subErr } = await supabase.from('subscriptions').insert({
    broker_id: userId,
    stripe_customer_id: `test_cus_${userId.slice(0, 8)}`,
    stripe_subscription_id: `test_sub_${userId.slice(0, 8)}`,
    tier: spec.tier,
    price: TIER_PRICE_CENTS[spec.tier],
    currency: 'USD',
    billing_cycle: spec.tier === 'Founder Lifetime' ? 'lifetime' : 'annual',
    started_at: now.toISOString(),
    renewal_at: spec.tier === 'Founder Lifetime' ? null : renewal.toISOString(),
    refund_eligible_until: refund.toISOString(),
    status: 'active',
  });
  if (subErr) throw new Error(`subscriptions ${spec.email}: ${subErr.message}`);
  console.log('  subscription: active');
}

async function main() {
  console.log('===== Brokers (create first, so leads below have someone to route to) =====');
  for (const spec of BROKER_SPECS) await createBroker(spec);

  console.log('\n===== Homeowners =====');
  for (const city of TARGET_CITIES) {
    for (let i = 1; i <= HOMEOWNERS_PER_CITY; i++) await createHomeowner(city, i);
  }

  console.log(`\nDone. Password for every account: ${PASSWORD}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
