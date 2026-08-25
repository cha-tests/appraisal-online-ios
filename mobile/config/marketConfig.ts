/**
 * Per-country property conventions: what size unit a market measures floor
 * area in, and the property type labels buyers there actually use.
 *
 * This is the single place that knows about a country's conventions. Adding a
 * new market — the next country after PH and AU — means adding one entry
 * here, not hunting through screens for US-flavoured strings.
 *
 * Nothing here changes what gets stored: `property_type` and `square_feet`
 * remain plain values on the property record regardless of market (size is
 * always normalised to sqft — see mobile/app/consumer/property-details.tsx).
 * This module only decides what the form offers and defaults to.
 */

export type SizeUnit = 'sqft' | 'sqm';
export type DistanceUnit = 'mi' | 'km';

export interface MarketConfig {
  sizeUnit: SizeUnit;
  distanceUnit: DistanceUnit;
  propertyTypes: string[];
}

// Countries with no entry here fall back to DEFAULT_MARKET below, so an
// address from a country we haven't tailored a form for yet still gets a
// sensible generic list rather than crashing or showing US-only terms.
//
// Note that "metric country" does not imply "measures real estate in square
// metres" — several markets below (GB, SG, AE) are otherwise metric but their
// property listings run in square feet by industry convention. Getting this
// wrong is worse than a missing entry, since it looks plausible while being
// off by a factor of ~10.
// distanceUnit does NOT always follow sizeUnit. Singapore, the UAE, and
// Canada all measure floor area in square feet but distance in kilometres —
// property size and road/travel distance are separate conventions, and
// several markets below only share one of the two with the US.
const MARKETS: Record<string, MarketConfig> = {
  US: {
    sizeUnit: 'sqft',
    distanceUnit: 'mi',
    propertyTypes: ['Single Family', 'Condo', 'Townhouse', 'Multi-Family', 'Land'],
  },
  PH: {
    sizeUnit: 'sqm',
    distanceUnit: 'km',
    propertyTypes: ['House and Lot', 'Condominium', 'Townhouse', 'Apartment', 'Vacant Lot'],
  },
  AU: {
    sizeUnit: 'sqm',
    distanceUnit: 'km',
    propertyTypes: ['House', 'Apartment/Unit', 'Townhouse', 'Villa', 'Vacant Land'],
  },
  GB: {
    // UK listings (Rightmove, Zoopla) are conventionally sq ft despite the UK
    // otherwise using metric units — and unlike SG/AE/CA below, the UK also
    // keeps miles for distance (road signage, speed limits), so both units
    // stay imperial here.
    sizeUnit: 'sqft',
    distanceUnit: 'mi',
    propertyTypes: [
      'Detached House',
      'Semi-Detached House',
      'Terraced House',
      'Flat/Apartment',
      'Bungalow',
      'Land',
    ],
  },
  SG: {
    // Singapore listings run in sq ft ("psf" pricing is standard) despite
    // Singapore otherwise using metric units. The large majority of
    // Singaporean housing is public HDB flats, not private condos — omitting
    // that category would misrepresent most of the market. Distance to
    // MRT/amenities is conventionally given in km, not miles.
    sizeUnit: 'sqft',
    distanceUnit: 'km',
    propertyTypes: ['HDB Flat', 'Condominium', 'Executive Condominium', 'Landed House', 'Apartment'],
  },
  AE: {
    // Dubai/UAE listings (Bayut, Property Finder) run in sq ft despite the
    // UAE otherwise using metric units; road distance is km.
    sizeUnit: 'sqft',
    distanceUnit: 'km',
    propertyTypes: ['Apartment', 'Villa', 'Townhouse', 'Penthouse', 'Land'],
  },
  CA: {
    // Canada measures home size in sq ft (like the US) but road distance in
    // km (unlike the US) — official metric signage despite the imperial
    // holdover for floor area.
    sizeUnit: 'sqft',
    distanceUnit: 'km',
    propertyTypes: ['Single Family', 'Condo', 'Townhouse', 'Duplex', 'Land'],
  },
  DE: {
    sizeUnit: 'sqm',
    distanceUnit: 'km',
    propertyTypes: ['House', 'Apartment', 'Semi-Detached House', 'Terraced House', 'Land'],
  },
};

// Most of the world measures floor area in square metres, so this is a
// reasonable placeholder for a country that hasn't been given its own entry
// yet — not a claim that it's locally correct. As the GB/SG/AE entries above
// show, several countries measure real estate specifically in square feet
// despite being metric everywhere else, so a country only belongs in
// MARKETS once that convention has actually been checked.
const DEFAULT_MARKET: MarketConfig = {
  sizeUnit: 'sqm',
  distanceUnit: 'km',
  propertyTypes: ['House', 'Apartment/Condo', 'Townhouse', 'Vacant Land'],
};

export function getMarketConfig(countryCode?: string | null): MarketConfig {
  if (!countryCode) return DEFAULT_MARKET;
  return MARKETS[countryCode] ?? DEFAULT_MARKET;
}

const MILES_TO_KM = 1.60934;

/**
 * Formats a comparable sale's distance for display.
 *
 * Comparable distances are always stored in miles (`distance_miles`), the
 * same "canonical storage unit, converted only at the display boundary"
 * approach used for square_feet elsewhere in this app — the field name and
 * stored value never change, only what's shown here.
 */
export function formatDistance(distanceMiles: number, countryCode?: string | null): string {
  const { distanceUnit } = getMarketConfig(countryCode);
  if (distanceUnit === 'km') {
    return `${(distanceMiles * MILES_TO_KM).toFixed(1)} km`;
  }
  return `${distanceMiles.toFixed(1)} mi`;
}

/**
 * Countries enabled in the Google Places address-search filter.
 *
 * Google's Autocomplete `components` parameter hard-caps country restriction
 * at 5 — verified live: a 6th country returns
 * `INVALID_REQUEST: Number of restrict_pairs must not exceed 5`. That cap is
 * independent of MARKETS above, which can hold as many countries as useful;
 * it only limits how many can be searchable at once. Swap entries here (there
 * is no ordering requirement) to change which 5 are live — AE, CA, and DE are
 * already configured in MARKETS above and just need a slot here.
 */
export const AUTOCOMPLETE_COUNTRIES = ['US', 'PH', 'AU', 'GB', 'SG'] as const;
