/**
 * Provisions the two demo accounts for Apple's Beta App Review (Guideline
 * 2.1(a) — "Information Needed": the reviewer had no way to sign in and see
 * real functionality). Unlike the throwaway `_tmp-*` scripts used during
 * manual QA this session, these accounts are meant to stay in the database
 * — do not delete them after review, Apple may revisit the same build.
 *
 * Creates:
 *   - a broker account, already past KYC and payment (the two steps in
 *     broker onboarding a reviewer cannot get through themselves — KYC needs
 *     a real ID photo, payment needs a real card), with one lead already
 *     routed to it so lead-inbox/lead-detail/dashboard show real content
 *     instead of empty states.
 *   - a consumer account with one already-generated report, opted in to
 *     broker contact (linked to the same lead above), so report-view,
 *     confirmation, and the account's report list all show real content too.
 *
 * Idempotent: safe to re-run. Skips auth-user creation if the email already
 * exists, and upserts everything else either way.
 *
 * Usage:
 *   cd appraisal-online-ios
 *   npx tsx scripts/create-apple-review-demo.ts
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

const PASSWORD = 'AppleReview2026!';
const BROKER_EMAIL = 'apple.demo.broker@appraisalonline.ai';
const CONSUMER_EMAIL = 'apple.demo.consumer@appraisalonline.ai';

async function getOrCreateAuthUser(
  email: string,
  userType: 'broker' | 'consumer',
  fullName: string
): Promise<string> {
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (existing) {
    console.log(`  users row already exists (${existing.id})`);
    return existing.id;
  }

  const { data: created, error } = await supabase.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { user_type: userType, full_name: fullName },
  });

  if (error || !created.user) {
    throw new Error(`Failed to create auth user for ${email}: ${error?.message}`);
  }

  const { data: row } = await supabase
    .from('users')
    .select('id')
    .eq('id', created.user.id)
    .maybeSingle();

  if (!row) {
    const { error: insertError } = await supabase.from('users').insert({
      id: created.user.id,
      email,
      user_type: userType,
      full_name: fullName,
      phone: '09171234567',
    });
    if (insertError) throw new Error(`Failed to insert users row: ${insertError.message}`);
  }

  console.log(`  created auth user + users row (${created.user.id})`);
  return created.user.id;
}

async function setupBroker(): Promise<{ userId: string }> {
  console.log(`\n${BROKER_EMAIL}:`);
  const userId = await getOrCreateAuthUser(BROKER_EMAIL, 'broker', 'Apple Reviewer (Broker Demo)');

  const { data: city, error: cityError } = await supabase
    .from('cities')
    .select('id')
    .limit(1)
    .single();
  if (cityError || !city) {
    throw new Error('Could not find a seeded city — run the city seed migration first.');
  }

  const { data: existingProfile } = await supabase
    .from('broker_profiles')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (existingProfile) {
    console.log('  broker_profiles row already exists — ensuring KYC/paid status');
    const { error } = await supabase
      .from('broker_profiles')
      .update({
        kyc_status: 'approved',
        kyc_submitted_at: new Date().toISOString(),
        kyc_reviewed_at: new Date().toISOString(),
      })
      .eq('user_id', userId);
    if (error) throw new Error(`Failed to update broker_profiles: ${error.message}`);
  } else {
    const { error } = await supabase.from('broker_profiles').insert({
      user_id: userId,
      company_name: 'Demo Realty Group',
      license_number: 'DEMO-000000',
      bio: 'Demo broker account provisioned for Apple Beta App Review.',
      phone: '09171234567',
      tier: 'Premium Annual',
      selected_cities: [city.id],
      email_enabled: true,
      push_enabled: true,
      sms_enabled: false,
      kyc_status: 'approved',
      kyc_submitted_at: new Date().toISOString(),
      kyc_reviewed_at: new Date().toISOString(),
    });
    if (error) throw new Error(`Failed to create broker_profiles row: ${error.message}`);
    console.log('  created broker_profiles row (KYC approved)');
  }

  const { data: existingSub } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('broker_id', userId)
    .maybeSingle();

  if (!existingSub) {
    const startedAt = new Date();
    const refundEligibleUntil = new Date(startedAt);
    refundEligibleUntil.setDate(refundEligibleUntil.getDate() + 30);
    const renewalAt = new Date(startedAt);
    renewalAt.setFullYear(renewalAt.getFullYear() + 1);

    const { error } = await supabase.from('subscriptions').insert({
      broker_id: userId,
      stripe_customer_id: `demo_cus_${userId.slice(0, 8)}`,
      stripe_subscription_id: `demo_sub_${userId.slice(0, 8)}`,
      tier: 'Premium Annual',
      price: 500000,
      currency: 'PHP',
      billing_cycle: 'annual',
      started_at: startedAt.toISOString(),
      renewal_at: renewalAt.toISOString(),
      refund_eligible_until: refundEligibleUntil.toISOString(),
      status: 'active',
    });
    if (error) throw new Error(`Failed to create subscriptions row: ${error.message}`);
    console.log('  created active subscriptions row (Premium Annual, paid)');
  } else {
    console.log('  subscriptions row already exists, leaving as-is');
  }

  return { userId };
}

async function setupConsumerWithReport(brokerId: string) {
  console.log(`\n${CONSUMER_EMAIL}:`);
  const userId = await getOrCreateAuthUser(CONSUMER_EMAIL, 'consumer', 'Apple Reviewer (Consumer Demo)');

  const { data: existingProperty } = await supabase
    .from('properties')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  let propertyId: string;
  const address = '122 Rockwell Dr, Makati City, Metro Manila, Philippines';

  if (existingProperty) {
    console.log('  property already exists, reusing it');
    propertyId = existingProperty.id;
  } else {
    const { data: property, error } = await supabase
      .from('properties')
      .insert({
        user_id: userId,
        address,
        address_components: {
          city: 'Makati City',
          route: 'Rockwell Drive',
          country: 'Philippines',
          province: 'Metro Manila',
          street_number: '122',
          country_code: 'PH',
          is_precise: true,
        },
        bedrooms: 4,
        bathrooms: 3,
        square_feet: 2000,
        year_built: 1998,
        property_type: 'House and Lot',
        condition: 'Good',
      })
      .select()
      .single();
    if (error || !property) throw new Error(`Failed to create property: ${error?.message}`);
    propertyId = property.id;
    console.log('  created property');
  }

  const { data: existingReport } = await supabase
    .from('reports')
    .select('id')
    .eq('property_id', propertyId)
    .maybeSingle();

  let reportId: string;

  if (existingReport) {
    console.log('  report already exists, ensuring broker opt-in');
    reportId = existingReport.id;
    const { error } = await supabase
      .from('reports')
      .update({ broker_contact_opted_in: true, phone_provided: '09171234567' })
      .eq('id', reportId);
    if (error) throw new Error(`Failed to update report: ${error.message}`);
  } else {
    const { data: report, error } = await supabase
      .from('reports')
      .insert({
        user_id: userId,
        property_id: propertyId,
        estimated_value: 68000000,
        confidence_range: { low: 62000000, high: 74000000 },
        comparables: [
          {
            address: 'Constellation Street, Bel-Air Village, Makati City',
            distance_miles: 0.25,
            sale_price: 72500000,
            sale_date: '2024-01-18',
            similarity_score: 0.91,
          },
          {
            address: 'Manalac Street, Poblacion, Makati City',
            distance_miles: 0.43,
            sale_price: 63000000,
            sale_date: '2023-11-28',
            similarity_score: 0.86,
          },
        ],
        gemini_response: { country_code: 'PH' },
        broker_contact_opted_in: true,
        phone_provided: '09171234567',
        status: 'generated',
      })
      .select()
      .single();
    if (error || !report) throw new Error(`Failed to create report: ${error?.message}`);
    reportId = report.id;
    console.log('  created report (broker contact opted in)');
  }

  const { data: existingLead } = await supabase
    .from('leads')
    .select('id')
    .eq('report_id', reportId)
    .maybeSingle();

  let leadId: string;

  if (existingLead) {
    console.log('  lead already exists, reusing it');
    leadId = existingLead.id;
  } else {
    const { data: lead, error } = await supabase
      .from('leads')
      .insert({
        report_id: reportId,
        property_id: propertyId,
        consumer_id: userId,
        consumer_email: CONSUMER_EMAIL,
        consumer_phone: '09171234567',
        property_address: address,
        property_value: 68000000,
        status: 'new',
      })
      .select()
      .single();
    if (error || !lead) throw new Error(`Failed to create lead: ${error?.message}`);
    leadId = lead.id;
    console.log('  created lead');
  }

  const { data: existingRouting } = await supabase
    .from('lead_routings')
    .select('id')
    .eq('lead_id', leadId)
    .eq('broker_id', brokerId)
    .maybeSingle();

  if (!existingRouting) {
    const { error } = await supabase.from('lead_routings').insert({
      lead_id: leadId,
      broker_id: brokerId,
      delivery_channel: 'email',
      delivery_status: 'sent',
      delivery_timestamp: new Date().toISOString(),
    });
    if (error) throw new Error(`Failed to create lead_routings row: ${error.message}`);
    console.log('  routed lead to demo broker');
  } else {
    console.log('  lead already routed to demo broker');
  }
}

async function main() {
  const { userId: brokerId } = await setupBroker();
  await setupConsumerWithReport(brokerId);

  console.log('\nDone.\n');
  console.log('Demo credentials for App Store Connect > TestFlight > Test Information > Beta App Review Information:');
  console.log(`  Broker (paid, KYC approved, has a lead):   ${BROKER_EMAIL} / ${PASSWORD}`);
  console.log(`  Consumer (has a generated report):          ${CONSUMER_EMAIL} / ${PASSWORD}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
