// Mirrors mobile/config/marketConfig.ts's currency map — backend and mobile
// are separate packages with no shared module today (the same duplication
// formatDistance.ts already has), so this is kept in sync by hand.
const MARKETS: Record<string, string> = {
  US: 'USD',
  PH: 'PHP',
  AU: 'AUD',
  GB: 'GBP',
  SG: 'SGD',
  AE: 'AED',
  CA: 'CAD',
  DE: 'EUR',
};

const DEFAULT_CURRENCY = 'USD';

/**
 * Formats a monetary amount (property values, comparable sale prices — NOT
 * broker subscription pricing, which stays USD-only by deliberate business
 * decision) for display, in the currency of the property's market.
 *
 * amountMinorUnits is the stored integer (cents/centavos/fils/...); divided
 * by 100 here, the same convention every money field in this app uses.
 */
export function formatCurrency(amountMinorUnits: number, countryCode?: string | null): string {
  const currency = (countryCode && MARKETS[countryCode]) || DEFAULT_CURRENCY;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amountMinorUnits / 100);
}
