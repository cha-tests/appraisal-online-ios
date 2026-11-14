/**
 * Web-only Google Places lookup, used by consumer/home.tsx in place of the
 * backend proxy it used to call.
 *
 * Unlike Gemini (see report.service.ts's own comment), the Places REST API
 * genuinely can't be called directly from a browser — Google doesn't send
 * Access-Control-Allow-Origin headers for it, so any fetch/XHR straight to
 * maps.googleapis.com/maps/api/place/... is rejected by the browser before
 * Google's response is even read. That's not a security choice to work
 * around, it's why Google ships a separate JavaScript library for exactly
 * this use case: loaded as a <script> tag, it isn't subject to that CORS
 * restriction, and needs no backend.
 *
 * Both functions below return a response shaped like the old REST API's
 * envelope ({status, predictions}/{status, result}) rather than whatever
 * shape the JS SDK's own callback hands back, so consumer/home.tsx's
 * existing status-check / field-access code didn't need to change — only
 * which function it calls on web.
 *
 * Uses a separate _WEB-suffixed key from the one consumer/home.tsx's native
 * branch uses (EXPO_PUBLIC_GOOGLE_PLACES_API_KEY) — a Google API key's
 * "Application restrictions" are mutually exclusive (Websites XOR iOS apps
 * XOR Android apps XOR none), so a key restricted by HTTP referrer for this
 * web usage genuinely can't also work for the native app's calls, and vice
 * versa. See report.service.ts's matching comment on the Gemini key for the
 * same reasoning.
 */

const PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY_WEB;

let scriptLoadPromise: Promise<void> | null = null;

function loadGoogleMapsScript(): Promise<void> {
  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise((resolve, reject) => {
    if ((window as any).google?.maps?.places) {
      resolve();
      return;
    }
    if (!PLACES_API_KEY) {
      reject(new Error('Missing EXPO_PUBLIC_GOOGLE_PLACES_API_KEY'));
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      PLACES_API_KEY
    )}&libraries=places`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load the Google Maps JavaScript API'));
    document.head.appendChild(script);
  });

  return scriptLoadPromise;
}

let autocompleteService: any = null;
// PlacesService needs a Map or an HTMLElement to construct, even though
// this app only wants place details, not a rendered map — a detached div
// (never attached to the DOM) is the standard way to satisfy that without
// drawing an actual map anywhere.
let placesService: any = null;

async function ensureServices(): Promise<void> {
  await loadGoogleMapsScript();
  const places = (window as any).google.maps.places;
  if (!autocompleteService) autocompleteService = new places.AutocompleteService();
  if (!placesService) placesService = new places.PlacesService(document.createElement('div'));
}

/** Mirrors componentsFilterFor's REST-style "country:US|country:PH" format. */
function countryCodesFromComponentsFilter(componentsFilter: string): string[] {
  return componentsFilter
    .split('|')
    .map((part) => part.replace(/^country:/, '').trim())
    .filter(Boolean);
}

export async function autocompleteOnWeb(
  input: string,
  componentsFilter: string
): Promise<{ status: string; predictions: any[]; error_message?: string }> {
  try {
    await ensureServices();
  } catch (err) {
    return { status: 'REQUEST_DENIED', predictions: [], error_message: (err as Error).message };
  }

  return new Promise((resolve) => {
    autocompleteService.getPlacePredictions(
      {
        input,
        componentRestrictions: { country: countryCodesFromComponentsFilter(componentsFilter) },
      },
      (predictions: any[] | null, status: string) => {
        resolve({
          status,
          predictions: (predictions || []).map((p) => ({
            place_id: p.place_id,
            description: p.description,
            structured_formatting: p.structured_formatting,
          })),
        });
      }
    );
  });
}

export async function placeDetailsOnWeb(
  placeId: string
): Promise<{ status: string; result?: any; error_message?: string }> {
  try {
    await ensureServices();
  } catch (err) {
    return { status: 'REQUEST_DENIED', error_message: (err as Error).message };
  }

  return new Promise((resolve) => {
    placesService.getDetails(
      { placeId, fields: ['geometry', 'formatted_address', 'address_components'] },
      (result: any, status: string) => {
        if (status !== 'OK' || !result) {
          resolve({ status, error_message: status });
          return;
        }
        // The JS SDK's LatLng exposes lat/lng as methods, not plain
        // properties — converted here to the REST API's plain-number shape
        // so the caller's existing `geometry?.location?.lat` access works
        // unchanged.
        resolve({
          status: 'OK',
          result: {
            formatted_address: result.formatted_address,
            address_components: result.address_components,
            geometry: {
              location: {
                lat: result.geometry?.location?.lat?.(),
                lng: result.geometry?.location?.lng?.(),
              },
            },
          },
        });
      }
    );
  });
}
