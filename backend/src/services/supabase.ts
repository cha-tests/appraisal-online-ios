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
  const { data, error } = await supabase
    .from('reports')
    .select(`
      *,
      comparables:comparable_sales(*)
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
