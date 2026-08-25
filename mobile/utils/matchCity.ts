import { supabase } from '../services/supabase';

/**
 * Matches a resolved address's locality against the seeded `cities` table, so
 * a lead can be routed to brokers subscribed to that city.
 *
 * Google's locality name and the seeded city names disagree on the "City"
 * suffix, and not consistently in one direction. Verified live against
 * Google for every seeded Philippine city:
 *
 *   Google "Makati City"           vs seed "Makati"          (Google adds it)
 *   Google "Davao City"            vs seed "Davao City"      (already matches)
 *   Google "Cagayan De Oro City"   vs seed "Cagayan de Oro"  (Google adds it, case differs too)
 *
 * Stripping a trailing "city" from both sides and comparing case-insensitively
 * resolved every one of those.
 */
const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+city$/, '');

/**
 * Finds the seeded city row matching a resolved address's city and country.
 *
 * Returns null (rather than throwing) when there's no match — a lead for a
 * city we haven't seeded yet, or with incomplete address data, should still
 * get created; it simply won't route to anyone until routing is decided for
 * unlisted areas.
 */
export async function findCityId(
  cityName: string | undefined | null,
  countryCode: string | undefined | null
): Promise<string | null> {
  if (!cityName || !countryCode) return null;

  const { data, error } = await supabase
    .from('cities')
    .select('id, name')
    .eq('country', countryCode);

  if (error || !data) {
    console.error('Error looking up cities for routing:', error);
    return null;
  }

  const target = normalize(cityName);
  const match = data.find((c) => normalize(c.name) === target);
  return match?.id ?? null;
}
