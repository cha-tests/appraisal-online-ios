import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set');
}

/**
 * Supabase client with service role key
 * Used for admin operations (creating subscriptions, updating records)
 */
export const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Computes what a broker should be charged right now, using the database's
 * own get_broker_annual_price (migration 034) as the single source of
 * truth — never a value sent by the client.
 *
 * Reads the broker's signup_rank directly (a plain SELECT, service role
 * bypasses RLS) rather than calling claim_broker_signup_rank — that RPC's
 * self-only check compares p_user_id against auth.uid(), which is only
 * meaningful for a request carrying the broker's own session JWT (how
 * mobile's brokerService.claimBrokerSignupRank calls it, during
 * onboarding, before a broker ever reaches checkout); this server runs on
 * the service-role key, which has no such session and would always fail
 * that check. By the time a broker reaches checkout, onboarding has
 * already claimed their rank, so this only ever reads it.
 */
export async function getBrokerSignupPrice(userId: string): Promise<number> {
  const { data: profile, error: profileError } = await supabase
    .from('broker_profiles')
    .select('signup_rank')
    .eq('user_id', userId)
    .single();
  if (profileError) throw profileError;
  if (!profile?.signup_rank) {
    throw new Error(`Broker ${userId} has no signup_rank — onboarding must complete before checkout`);
  }

  const { data: priceCents, error: priceError } = await supabase.rpc('get_broker_annual_price', {
    p_signup_rank: profile.signup_rank,
  });
  if (priceError) throw priceError;

  return priceCents as number;
}

/**
 * Get a user by ID
 */
export async function getUser(userId: string) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get a report by ID
 */
export async function getReport(reportId: string) {
  // `comparables` is already a JSONB column on `reports` itself (the array
  // Gemini/mock valuation produced) — there is no `comparable_sales` table,
  // so a `comparables:comparable_sales(*)` join here would either error or
  // silently shadow that real column. Property facts (address, bedrooms,
  // etc.) live on the separate `properties` row instead, joined via
  // `property_id`, so pdf.ts reads them from `data.properties`.
  const { data, error } = await supabase
    .from('reports')
    .select(`
      *,
      properties(*)
    `)
    .eq('id', reportId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get subscription by user ID
 */
export async function getSubscription(userId: string) {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('broker_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 is "no rows returned"
    throw error;
  }

  return data || null;
}

/**
 * Create a subscription record
 */
export async function createSubscription(
  brokerId: string,
  stripeCustomerId: string,
  stripeSubscriptionId: string,
  tier: string
) {
  const { data, error } = await supabase
    .from('subscriptions')
    .insert([
      {
        broker_id: brokerId,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
        tier,
        status: 'active',
        created_at: new Date().toISOString(),
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update subscription status
 */
export async function updateSubscription(
  subscriptionId: string,
  updates: any
) {
  const { data, error } = await supabase
    .from('subscriptions')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', subscriptionId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Create a refund log entry
 */
export async function createRefundLog(
  subscriptionId: string,
  brokerId: string,
  amount: number,
  reason: string
) {
  const { data, error } = await supabase
    .from('refund_log')
    .insert([
      {
        subscription_id: subscriptionId,
        broker_id: brokerId,
        amount,
        reason,
        status: 'pending',
        created_at: new Date().toISOString(),
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}
