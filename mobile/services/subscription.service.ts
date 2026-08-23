import { supabase, parseSupabaseError } from './supabase';
import { Subscription, RefundLogEntry, BrokerTier } from '../types';

const TIER_PRICING = {
  'Founder Lifetime': { price: 49900, currency: 'USD', refundWindow: 14 }, // $499, 14 days
  'Premium Annual': { price: 19900, currency: 'USD', refundWindow: 30 }, // $199/year, 30 days
  'Basic Annual': { price: 4900, currency: 'USD', refundWindow: 30 }, // $49/year, 30 days
};

const TIER_CITIES = {
  'Founder Lifetime': 25,
  'Premium Annual': 10,
  'Basic Annual': 1,
};

export const subscriptionService = {
  // Get tier pricing and details
  getTierInfo(tier: BrokerTier) {
    return {
      ...TIER_PRICING[tier],
      cities: TIER_CITIES[tier],
    };
  },

  // Create a subscription after successful payment
  async createSubscription(
    brokerId: string,
    stripeCustomerId: string,
    stripeSubscriptionId: string,
    tier: BrokerTier,
    billingCycle: 'lifetime' | 'annual'
  ) {
    try {
      const tierInfo = TIER_PRICING[tier];
      const startedAt = new Date().toISOString();

      // Calculate refund_eligible_until based on tier
      const refundWindow = tierInfo.refundWindow;
      const refundEligibleUntil = new Date(new Date().getTime() + refundWindow * 24 * 60 * 60 * 1000).toISOString();

      let renewalAt = null;
      if (billingCycle === 'annual') {
        renewalAt = new Date(new Date().getTime() + 365 * 24 * 60 * 60 * 1000).toISOString();
      }

      const { data, error } = await supabase
        .from('subscriptions')
        .insert({
          broker_id: brokerId,
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: stripeSubscriptionId,
          tier,
          price: tierInfo.price,
          currency: tierInfo.currency,
          billing_cycle: billingCycle,
          started_at: startedAt,
          renewal_at: renewalAt,
          refund_eligible_until: refundEligibleUntil,
          status: 'active',
        })
        .select()
        .single();

      if (error) throw error;

      return { success: true, subscription: data as Subscription };
    } catch (error) {
      return {
        success: false,
        error: parseSupabaseError(error),
      };
    }
  },

  // Get subscription for a broker
  async getBrokerSubscription(brokerId: string) {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('broker_id', brokerId)
        .eq('status', 'active')
        .single();

      if (error && error.code === 'PGRST116') {
        return { success: true, subscription: null };
      }

      if (error) throw error;

      return { success: true, subscription: data as Subscription };
    } catch (error) {
      return {
        success: false,
        error: parseSupabaseError(error),
      };
    }
  },

  // Check refund eligibility
  async checkRefundEligibility(brokerId: string): Promise<{
    eligible: boolean;
    tier?: BrokerTier;
    daysSincePurchase?: number;
    refundWindow?: number;
    expiresAt?: string;
  }> {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('tier, started_at, refund_eligible_until')
        .eq('broker_id', brokerId)
        .eq('status', 'active')
        .single();

      if (error || !data) {
        return { eligible: false };
      }

      const now = new Date();
      const startedAt = new Date(data.started_at);
      const refundEligibleUntil = new Date(data.refund_eligible_until);
      const daysSincePurchase = Math.floor((now.getTime() - startedAt.getTime()) / (1000 * 60 * 60 * 24));
      const refundWindow = TIER_PRICING[data.tier as BrokerTier].refundWindow;

      return {
        eligible: now < refundEligibleUntil,
        tier: data.tier,
        daysSincePurchase,
        refundWindow,
        expiresAt: refundEligibleUntil.toISOString(),
      };
    } catch (error) {
      console.error('Error checking refund eligibility:', error);
      return { eligible: false };
    }
  },

  // Request a refund
  async requestRefund(brokerId: string, reason?: string) {
    try {
      // Check eligibility
      const eligibility = await this.checkRefundEligibility(brokerId);

      if (!eligibility.eligible) {
        return {
          success: false,
          error: {
            message: `Refunds are only available within ${eligibility.refundWindow} days of purchase.`,
            code: 'REFUND_WINDOW_EXPIRED',
          },
        };
      }

      // Get subscription
      const { data: subscription, error: subError } = await supabase
        .from('subscriptions')
        .select('id, tier, price, refund_eligible_until')
        .eq('broker_id', brokerId)
        .eq('status', 'active')
        .single();

      if (subError || !subscription) throw new Error('Subscription not found');

      // Create refund log entry
      const { data: refundEntry, error: refundError } = await supabase
        .from('refund_log')
        .insert({
          subscription_id: subscription.id,
          broker_id: brokerId,
          tier: subscription.tier,
          refund_amount: subscription.price,
          refund_reason: reason,
          days_since_purchase: eligibility.daysSincePurchase || 0,
          refund_eligible: true,
          status: 'requested',
        })
        .select()
        .single();

      if (refundError) throw refundError;

      return {
        success: true,
        refund: refundEntry as RefundLogEntry,
        message: 'Refund requested successfully. Processing may take 5-10 business days.',
      };
    } catch (error) {
      return {
        success: false,
        error: parseSupabaseError(error),
      };
    }
  },

  // Get refund history for a broker
  async getRefundHistory(brokerId: string) {
    try {
      const { data, error } = await supabase
        .from('refund_log')
        .select('*')
        .eq('broker_id', brokerId)
        .order('requested_at', { ascending: false });

      if (error) throw error;

      return { success: true, refunds: data as RefundLogEntry[] };
    } catch (error) {
      return {
        success: false,
        error: parseSupabaseError(error),
      };
    }
  },

  // Cancel subscription
  async cancelSubscription(brokerId: string, reason?: string) {
    try {
      const { error } = await supabase
        .from('subscriptions')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
        })
        .eq('broker_id', brokerId);

      if (error) throw error;

      return { success: true, message: 'Subscription cancelled' };
    } catch (error) {
      return {
        success: false,
        error: parseSupabaseError(error),
      };
    }
  },

  // Check refund rate for health monitoring (30-day rolling)
  async getRefundRate(tier?: BrokerTier) {
    try {
      const thirtyDaysAgo = new Date(new Date().getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

      let query = supabase
        .from('refund_log')
        .select('status, tier')
        .gte('requested_at', thirtyDaysAgo);

      if (tier) {
        query = query.eq('tier', tier);
      }

      const { data, error } = await query;

      if (error) throw error;

      const total = data?.length || 0;
      const completed = data?.filter((r: any) => r.status === 'completed').length || 0;
      const rate = total > 0 ? (completed / total) * 100 : 0;

      return {
        success: true,
        refundRate: rate,
        completedRefunds: completed,
        totalRequests: total,
        isCritical: rate > 10,
      };
    } catch (error) {
      return {
        success: false,
        error: parseSupabaseError(error),
      };
    }
  },

  // Get renewal reminder for annual tiers
  async getRenewalInfo(brokerId: string) {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('tier, renewal_at, billing_cycle')
        .eq('broker_id', brokerId)
        .eq('status', 'active')
        .single();

      if (error || !data || data.billing_cycle === 'lifetime') {
        return { success: true, renewal: null };
      }

      const now = new Date();
      const renewalAt = new Date(data.renewal_at);
      const daysUntilRenewal = Math.ceil((renewalAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      return {
        success: true,
        renewal: {
          tier: data.tier,
          renewalDate: data.renewal_at,
          daysUntilRenewal,
          isReminderWindow: daysUntilRenewal <= 30,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: parseSupabaseError(error),
      };
    }
  },
};
