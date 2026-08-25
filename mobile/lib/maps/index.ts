/**
 * Web stand-in for react-native-maps.
 *
 * Metro resolves `index.native.ts` on iOS/Android and this file on web. As with
 * the Stripe shim, the platform extension is what keeps the native module out
 * of the web bundle — a runtime Platform check would not, since Metro resolves
 * imports statically at bundle time.
 */

export const isMapAvailable = false;
export const MapView: any = null;
export const Marker: any = null;
