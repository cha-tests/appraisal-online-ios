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
  // ISO 4217 currency code property values in this market are actually
  // denominated in. A PHP-market home isn't "worth millions of US dollars" —
  // it was, before this existed, because every screen and the Gemini prompt
  // both hardcoded USD regardless of country. estimated_value/sale_price are
  // still stored as a plain integer of the currency's minor unit (cents,
  // centavos, ...) — this only decides what currency that integer means and
  // how it displays, the same "stored value stays put, only display/prompt
  // wording changes" approach as sizeUnit/distanceUnit above.
  currency: string;
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
    currency: 'USD',
  },
  PH: {
    sizeUnit: 'sqm',
    distanceUnit: 'km',
    propertyTypes: ['House and Lot', 'Condominium', 'Townhouse', 'Apartment', 'Vacant Lot'],
    currency: 'PHP',
  },
  AU: {
    sizeUnit: 'sqm',
    distanceUnit: 'km',
    propertyTypes: ['House', 'Apartment/Unit', 'Townhouse', 'Villa', 'Vacant Land'],
    currency: 'AUD',
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
    currency: 'GBP',
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
    currency: 'SGD',
  },
  AE: {
    // Dubai/UAE listings (Bayut, Property Finder) run in sq ft despite the
    // UAE otherwise using metric units; road distance is km.
    sizeUnit: 'sqft',
    distanceUnit: 'km',
    propertyTypes: ['Apartment', 'Villa', 'Townhouse', 'Penthouse', 'Land'],
    currency: 'AED',
  },
  CA: {
    // Canada measures home size in sq ft (like the US) but road distance in
    // km (unlike the US) — official metric signage despite the imperial
    // holdover for floor area.
    sizeUnit: 'sqft',
    distanceUnit: 'km',
    propertyTypes: ['Single Family', 'Condo', 'Townhouse', 'Duplex', 'Land'],
    currency: 'CAD',
  },
  DE: {
    sizeUnit: 'sqm',
    distanceUnit: 'km',
    propertyTypes: ['House', 'Apartment', 'Semi-Detached House', 'Terraced House', 'Land'],
    currency: 'EUR',
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
  currency: 'USD',
};

// Appended to every market's property type list (see getMarketConfig) so
// there's always an escape hatch — a fixed list, however well-tailored to a
// country, can still miss a real property's type (an unusual local category,
// or the address's country not being resolvable at all — see isVacantLandType
// and the property-details.tsx screen for how the accompanying free-text
// field is handled).
export const OTHER_PROPERTY_TYPE = 'Others';

export function getMarketConfig(countryCode?: string | null): MarketConfig {
  const config = (countryCode && MARKETS[countryCode]) || DEFAULT_MARKET;
  return { ...config, propertyTypes: [...config.propertyTypes, OTHER_PROPERTY_TYPE] };
}

/**
 * Whether a market's property-type label denotes vacant land rather than a
 * building — every MARKETS entry above spells this option as exactly "Land",
 * "Vacant Lot", or "Vacant Land", so matching the whole string (anchored,
 * not a bare substring test) covers all of them without needing a parallel
 * per-market flag. A property this is true for has no building on it yet, so
 * "Year Built" doesn't apply.
 *
 * Must stay anchored to the full string — a plain /land|lot/ substring test
 * also matched PH's "House and Lot", a completed house, wrongly treating it
 * as unbuilt land and making Year Built look optional for it too.
 */
export function isVacantLandType(propertyType: string | undefined | null): boolean {
  if (!propertyType) return false;
  return /^(land|vacant lot|vacant land)$/i.test(propertyType.trim());
}

/**
 * Whether a market's property-type label denotes a unit with no lot of its
 * own — a condo, apartment, or flat sits on land the building as a whole
 * owns, not a parcel that comes with the individual unit, so "Lot Area"
 * doesn't apply to it the way it does to a house or townhouse.
 *
 * A substring match (not anchored like isVacantLandType) is deliberate here:
 * it needs to catch every market's phrasing — "Condo", "Condominium",
 * "Executive Condominium", "Apartment/Unit", "Flat/Apartment", "HDB Flat" —
 * without maintaining a parallel per-market list.
 */
export function isNoLotType(propertyType: string | undefined | null): boolean {
  if (!propertyType) return false;
  return /(condo|apartment|flat|hdb)/i.test(propertyType.trim());
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
 * Formats a monetary amount (property values, comparable sale prices — NOT
 * broker subscription pricing, which is deliberately USD-everywhere per a
 * separate decision) for display, in the currency of the property's market.
 *
 * amountMinorUnits is the stored integer (cents/centavos/fils/...), the
 * same "always divide by 100 at the display boundary" convention every
 * other money field in this app already uses.
 *
 * Locale is pinned to 'en-US' regardless of country — that's just what
 * decides digit grouping/decimal punctuation, and Intl.NumberFormat derives
 * the correct symbol (₱, A$, £, S$, etc.) from the `currency` code itself,
 * not the locale. Using a per-country locale (e.g. 'ar-AE') would risk
 * relying on ICU data that may not be as reliably bundled.
 */
export function formatCurrency(amountMinorUnits: number, countryCode?: string | null): string {
  const { currency } = getMarketConfig(countryCode);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amountMinorUnits / 100);
}

export const SQFT_PER_SQM = 10.7639;
export const sqftToSqm = (sqft: number) => sqft / SQFT_PER_SQM;
export const sqmToSqft = (sqm: number) => sqm * SQFT_PER_SQM;

/**
 * Rough per-unit-area baseline prices for generating placeholder comparable
 * sales, quoted in each market's OWN size unit (sqft or sqm — see MARKETS
 * above) so the conversion below only has to happen once, not per-market.
 *
 * These are NOT real data. There is currently no comparable-sales data
 * source wired up for any market (RentCast is the plan for US properties;
 * no equivalent has been found yet for PH or AU — see project notes). Before
 * this existed, every market reused the same USD-scale numbers regardless of
 * country, which produced a valuation ~20x too low the moment it was labeled
 * PHP instead of USD (₱725,000 for a whole house, when a comparable real
 * sale in Metro Manila is closer to ₱15-16M). These baselines exist only to
 * keep the placeholder numbers in the right order of magnitude per currency
 * until real data replaces them — they are not claims of local accuracy.
 */
const MOCK_PRICE_PER_UNIT_AREA: Record<string, number> = {
  US: 360, // USD/sqft
  PH: 65000, // PHP/sqm
  AU: 4500, // AUD/sqm
  GB: 400, // GBP/sqft
  SG: 900, // SGD/sqft — HDB and private condo prices differ by roughly 3x; this splits the difference
  AE: 1100, // AED/sqft
  CA: 350, // CAD/sqft
  DE: 3200, // EUR/sqm
};
const DEFAULT_PRICE_PER_UNIT_AREA = 3000; // for countries with no entry above; matches DEFAULT_MARKET's sqm/USD pairing

export interface MockComparableSale {
  address: string;
  sale_price: number;
  sale_date: string;
  distance_miles: number;
  similarity_score: number;
}

/**
 * Generates three placeholder comparable sales, scaled to the subject
 * property's own size and market so the fabricated numbers are at least
 * self-consistent (a bigger property gets bigger "comps", in the right
 * currency's order of magnitude) rather than a flat number reused for every
 * property everywhere. See MOCK_PRICE_PER_UNIT_AREA above for why this
 * exists and its limits — this is still not real comparable-sales data.
 *
 * @param squareFeet Property size as stored (always sqft, regardless of
 *   display unit — see property-details.tsx).
 */
export function generateMockComparableSales(
  squareFeet: number,
  countryCode?: string | null
): MockComparableSale[] {
  const { sizeUnit } = getMarketConfig(countryCode);
  const pricePerUnitArea =
    (countryCode && MOCK_PRICE_PER_UNIT_AREA[countryCode]) || DEFAULT_PRICE_PER_UNIT_AREA;
  const areaInMarketUnit = sizeUnit === 'sqm' ? sqftToSqm(squareFeet) : squareFeet;
  const baseline = areaInMarketUnit * pricePerUnitArea;

  // sale_price is stored in the currency's minor unit (cents/centavos/...),
  // matching every other money field in this app.
  const toMinorUnits = (majorUnitAmount: number) => Math.round(majorUnitAmount * 100);

  return [
    {
      address: '456 Oak Ave',
      sale_price: toMinorUnits(baseline * 1.03),
      sale_date: '2026-05-15',
      distance_miles: 0.3,
      similarity_score: 0.95,
    },
    {
      address: '789 Elm St',
      sale_price: toMinorUnits(baseline * 0.96),
      sale_date: '2026-04-20',
      distance_miles: 0.5,
      similarity_score: 0.88,
    },
    {
      address: '321 Pine Rd',
      sale_price: toMinorUnits(baseline * 1.06),
      sale_date: '2026-03-10',
      distance_miles: 0.7,
      similarity_score: 0.82,
    },
  ];
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

export interface PhoneCountry {
  /** ISO country code — matches the MARKETS keys above. */
  code: string;
  dialCode: string;
  flag: string;
  name: string;
}

// PH listed first (not alphabetical) since it's this app's primary launch
// market — see project notes — so the phone country picker defaults to it
// rather than an arbitrary/US-centric choice. Covers the same countries as
// MARKETS above; add an entry here whenever one is added there.
export const PHONE_COUNTRIES: PhoneCountry[] = [
  { code: 'PH', dialCode: '+63', flag: '🇵🇭', name: 'Philippines' },
  { code: 'US', dialCode: '+1', flag: '🇺🇸', name: 'United States' },
  { code: 'AU', dialCode: '+61', flag: '🇦🇺', name: 'Australia' },
  { code: 'GB', dialCode: '+44', flag: '🇬🇧', name: 'United Kingdom' },
  { code: 'SG', dialCode: '+65', flag: '🇸🇬', name: 'Singapore' },
  { code: 'AE', dialCode: '+971', flag: '🇦🇪', name: 'United Arab Emirates' },
  { code: 'CA', dialCode: '+1', flag: '🇨🇦', name: 'Canada' },
  { code: 'DE', dialCode: '+49', flag: '🇩🇪', name: 'Germany' },
];

export const DEFAULT_PHONE_COUNTRY = PHONE_COUNTRIES[0];
