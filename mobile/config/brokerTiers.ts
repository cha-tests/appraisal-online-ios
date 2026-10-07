import { BrokerTier } from '../types';

/**
 * Single source of truth for broker plan pricing and features, matching
 * CLAUDE.md's locked membership tiers table: Founder Lifetime $499 one-time
 * (25 cities), Premium Annual $199/year (10 cities), Basic Annual $49/year
 * (1 city). All three are offered at signup; none are free.
 *
 * Previously this pricing lived duplicated (and drifted out of sync)
 * across paywall.tsx, checkout.tsx, and subscription.service.ts — this file
 * replaces all three copies.
 */
export const BROKER_TIER_CITY_LIMITS: Record<BrokerTier, number> = {
  'Founder Lifetime': 25,
  'Premium Annual': 10,
  'Basic Annual': 1,
};
export const BROKER_TIER_PRICING: Record<
  BrokerTier,
  { price: number; currency: string; refundWindow: number; billingCycle: 'lifetime' | 'annual' }
> = {
  'Founder Lifetime': { price: 49900, currency: 'USD', refundWindow: 14, billingCycle: 'lifetime' },
  'Premium Annual': { price: 19900, currency: 'USD', refundWindow: 30, billingCycle: 'annual' },
  'Basic Annual': { price: 4900, currency: 'USD', refundWindow: 30, billingCycle: 'annual' },
};

export const BROKER_TIER_FEATURES: Record<
  BrokerTier,
  { cities: string; leads: string; channels: string; includes: string[] }
> = {
  'Founder Lifetime': {
    cities: '25 cities',
    leads: 'Real-time',
    channels: 'Email, Push, SMS',
    includes: [
      'Verified Founder badge',
      'Top placement on Find a Pro page',
      'Monthly market intelligence',
      'Lifetime access',
    ],
  },
  'Premium Annual': {
    cities: '10 cities',
    leads: 'Real-time',
    channels: 'Email, Push',
    includes: [
      'Enhanced profile with photo & bio',
      'Real-time lead notifications',
      'Quarterly market reports',
      'Annual renewal',
    ],
  },
  'Basic Annual': {
    cities: '1 city',
    leads: 'Weekly digest',
    channels: 'Email',
    includes: ['Standard profile', 'Weekly Monday digest'],
  },
};

/** "Free" for a zero-cost tier, otherwise a formatted currency amount. */
export function formatTierPrice(tier: BrokerTier): string {
  const { price, currency } = BROKER_TIER_PRICING[tier];
  if (price === 0) return 'Free';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(price / 100);
}
