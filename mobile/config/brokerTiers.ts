import { BrokerTier } from '../types';

/**
 * Single source of truth for the broker plan (migration 034 — a single
 * tier replaced the old Founder Lifetime / Premium Annual / Basic Annual
 * three-tier model). Every broker covers 5 cities, gets real-time email +
 * push notifications (no SMS, no weekly digest — those existed only to
 * differentiate the retired tiers), and has a 30-day refund window.
 *
 * Price is NOT a static lookup any more — it depends on a broker's place
 * in the global signup order (their `signup_rank`, claimed once via
 * `claim_broker_signup_rank` — see broker.service.ts) and today's date:
 *
 *   Through Dec 31, 2026 (intro pricing, by signup order):
 *     rank 1-1,000      -> $9.95/year
 *     rank 1,001-2,000  -> $14.95/year
 *     rank 2,001+       -> $19.95/year
 *   From Jan 1, 2027 onward:
 *     everyone, any rank, new signup or renewal -> $24.95/year flat
 *
 * getBrokerAnnualPrice mirrors the Postgres function `get_broker_annual_price`
 * exactly (migration 034) — kept in sync by hand, same convention already
 * used for other client/server-duplicated pricing logic in this codebase.
 * Prefer calling the RPC directly where a broker's real signup_rank is
 * already being fetched from the database, so there is only ever one
 * source of truth live at a time; this copy exists for screens that need
 * to show a price before/without a round trip (e.g. marketing copy).
 */
export const BROKER_TIER_CITY_LIMIT = 5;

export const BROKER_REFUND_WINDOW_DAYS = 30;

export const INTRO_PRICING_CUTOFF = new Date('2027-01-01T00:00:00Z');

export const BROKER_ANNUAL_PRICE_CENTS = {
  introTier1: 995, // $9.95 — first 1,000 signups
  introTier2: 1495, // $14.95 — next 1,000 signups
  introTier3: 1995, // $19.95 — every signup after that, through 2026
  standard: 2495, // $24.95 — everyone, from Jan 1, 2027 onward
} as const;

/** Cents. Mirrors the SQL function get_broker_annual_price(rank, as_of). */
export function getBrokerAnnualPrice(signupRank: number, asOf: Date = new Date()): number {
  if (asOf >= INTRO_PRICING_CUTOFF) return BROKER_ANNUAL_PRICE_CENTS.standard;
  if (signupRank <= 1000) return BROKER_ANNUAL_PRICE_CENTS.introTier1;
  if (signupRank <= 2000) return BROKER_ANNUAL_PRICE_CENTS.introTier2;
  return BROKER_ANNUAL_PRICE_CENTS.introTier3;
}

export function formatPriceCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

export const BROKER_TIER_FEATURES: Record<
  BrokerTier,
  { cities: string; leads: string; channels: string; includes: string[] }
> = {
  'Premium Annual': {
    cities: `${BROKER_TIER_CITY_LIMIT} cities`,
    leads: 'Real-time',
    channels: 'Email, Push',
    includes: [
      'Enhanced profile with photo & bio',
      'Real-time lead notifications',
      'Quarterly market reports',
      'Annual renewal',
    ],
  },
};
