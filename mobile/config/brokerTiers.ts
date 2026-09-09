import { BrokerTier } from '../types';

/**
 * Single source of truth for broker plan pricing and features.
 *
 * Per the Sep 1 pricing decision (see broker/onboarding.tsx), only
 * 'Basic Annual' (Free) and 'Premium Annual' (₱5,000/year) are offered at
 * signup, and neither has a city cap — 'selectedCities' in onboarding.tsx
 * lets a broker pick as many as they want regardless of tier.
 * 'Founder Lifetime' remains a valid BrokerTier value (other screens
 * reference it) but isn't reachable from onboarding until the founder-tier
 * mechanics are actually built.
 *
 * Previously this pricing lived duplicated (and drifted out of sync, still
 * showing the old $199/$49 USD figures) across paywall.tsx, checkout.tsx,
 * and subscription.service.ts — this file replaces all three copies.
 */
export const BROKER_TIER_PRICING: Record<
  BrokerTier,
  { price: number; currency: string; refundWindow: number; billingCycle: 'lifetime' | 'annual' }
> = {
  'Founder Lifetime': { price: 49900, currency: 'USD', refundWindow: 14, billingCycle: 'lifetime' },
  'Premium Annual': { price: 500000, currency: 'PHP', refundWindow: 30, billingCycle: 'annual' },
  'Basic Annual': { price: 0, currency: 'PHP', refundWindow: 30, billingCycle: 'annual' },
};

export const BROKER_TIER_FEATURES: Record<
  BrokerTier,
  { cities: string; leads: string; channels: string; includes: string[] }
> = {
  'Founder Lifetime': {
    cities: 'Unlimited',
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
    cities: 'Unlimited',
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
    cities: 'Unlimited',
    leads: 'Weekly digest',
    channels: 'Email',
    includes: ['Standard profile', 'Weekly Monday digest', 'No cost, ever'],
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
