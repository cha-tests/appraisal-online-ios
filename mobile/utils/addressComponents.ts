/**
 * Parsing for Google's `address_components` array.
 *
 * Google returns components as an unordered list, each tagged with one or more
 * `types`, and which types are present varies by country and by how precisely
 * the place is known. Pulling named fields out of that shape needs a lookup
 * rather than positional access.
 *
 * Philippine addresses differ from US ones in ways that matter here:
 *   - the barangay arrives as `sublocality` / `sublocality_level_1`
 *   - the province is `administrative_area_level_1`, and for Metro Manila
 *     addresses that value is "Metro Manila" (a region, not a province)
 *   - `street_number` is frequently absent — many properties are identified by
 *     subdivision, building, or lot rather than a street number
 */

export interface GoogleAddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

export interface ParsedAddress {
  /** House or building number, e.g. "6750". Often absent in PH. */
  streetNumber?: string;
  /** Street name, e.g. "Ayala Avenue". */
  route?: string;
  /** Unit or suite within a building. */
  subpremise?: string;
  /** Named building or compound. */
  premise?: string;
  /** Barangay (PH) / neighbourhood (US). */
  barangay?: string;
  /** City or municipality, e.g. "Makati City". */
  city?: string;
  /** Province, or "Metro Manila" for NCR addresses. */
  province?: string;
  /** US state code, e.g. "CA". Undefined outside the US. */
  stateCode?: string;
  postalCode?: string;
  country?: string;
  /** Two-letter country code, e.g. "PH". */
  countryCode?: string;
}

/** Find the first component carrying any of the given types. */
const pick = (
  components: GoogleAddressComponent[],
  types: string[],
  useShortName = false
): string | undefined => {
  for (const type of types) {
    const match = components.find((c) => c.types.includes(type));
    if (match) {
      return useShortName ? match.short_name : match.long_name;
    }
  }
  return undefined;
};

export function parseAddressComponents(
  components: GoogleAddressComponent[] | undefined | null
): ParsedAddress {
  if (!components?.length) return {};

  const countryCode = pick(components, ['country'], true);

  return {
    streetNumber: pick(components, ['street_number']),
    route: pick(components, ['route']),
    subpremise: pick(components, ['subpremise']),
    premise: pick(components, ['premise']),
    // PH returns the barangay as sublocality; US uses neighborhood.
    barangay: pick(components, [
      'sublocality_level_1',
      'sublocality',
      'neighborhood',
    ]),
    // Some PH municipalities come back only as admin_area_level_2.
    city: pick(components, ['locality', 'administrative_area_level_2']),
    province: pick(components, ['administrative_area_level_1']),
    // Only meaningful for the US, where admin_area_level_1 is a state.
    stateCode:
      countryCode === 'US'
        ? pick(components, ['administrative_area_level_1'], true)
        : undefined,
    postalCode: pick(components, ['postal_code']),
    country: pick(components, ['country']),
    countryCode,
  };
}

/**
 * Whether this resolves to one specific property rather than a whole street.
 *
 * A valuation needs a single property. Google will happily autocomplete a bare
 * route ("Ayala Avenue") or a district, and those cannot be appraised. A street
 * number is the usual proof of precision, but a named building or a unit is
 * equally specific — and in the Philippines that is often all that exists.
 */
export function isPreciseAddress(parsed: ParsedAddress): boolean {
  return Boolean(parsed.streetNumber || parsed.premise || parsed.subpremise);
}

// Google's Plus Codes use a restricted base-20 alphabet (no 0/1/I/O/S/U/etc,
// to avoid look-alike confusion) and a '+' separating the area and locality
// parts — e.g. the short form "8Q98+XR" or the full form
// "7QQ38Q98+XR, Makati City". Matched against the autocomplete prediction's
// description/main_text, not the resolved address_components, since Google
// does not tag these results with street_number/premise/subpremise the way
// it does a conventional address — see isPreciseAddress's comment for why
// that absence otherwise (wrongly) reads as "not a specific property".
const PLUS_CODE_PATTERN = /\b[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3}\b/i;

/**
 * Whether the given text is (or contains) a Plus Code.
 *
 * A Plus Code already pinpoints one specific location — it's just not
 * expressed as a house number. That makes it as precise as a street
 * number for valuation purposes, unlike a bare route or locality name
 * (which really is ambiguous over an entire street or neighborhood).
 */
export function isPlusCode(text: string | undefined | null): boolean {
  if (!text) return false;
  return PLUS_CODE_PATTERN.test(text);
}

/** Short one-line label for the resolved property, for confirmation UI. */
export function formatStreetLine(parsed: ParsedAddress): string {
  const { subpremise, streetNumber, route, premise } = parsed;
  const parts: string[] = [];

  if (subpremise) parts.push(`Unit ${subpremise}`);
  if (premise && !streetNumber) parts.push(premise);
  if (streetNumber) parts.push(streetNumber);
  if (route) parts.push(route);

  return parts.join(' ').trim();
}

/**
 * Short label for a saved property, used where the full formatted address
 * (house number, province, country and all) is too long to read at a
 * glance — the consumer's Account > Your Reports list.
 *
 * A conventional address collapses to "route, city", dropping the house
 * number — the list distinguishes reports well enough without it. A Plus
 * Code has no street name to show, so it collapses to just the city/town.
 */
export function shortAddressLabel(
  address: string | undefined | null,
  components?: Pick<ParsedAddress, 'route' | 'city'> | null
): string {
  if (!address) return '';

  const city = components?.city;

  if (isPlusCode(address)) {
    return city || address;
  }

  const route = components?.route;
  if (route && city) return `${route}, ${city}`;
  return city || route || address;
}
