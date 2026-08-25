/**
 * Web stand-in for the Stripe React Native SDK.
 *
 * Metro resolves `index.native.ts` on iOS/Android and this file on web. The
 * split is load-bearing: a runtime `Platform.OS !== 'web'` check around a
 * `require('@stripe/stripe-react-native')` does NOT stop Metro from resolving
 * it, because module resolution happens statically at bundle time. Importing
 * the SDK on web fails the whole web build with:
 *
 *   Importing native-only module "…/codegenNativeCommands" on web
 *
 * Keeping the native import behind a platform extension means the web bundle
 * never references it at all.
 */

export const isStripeAvailable = false;

/** No card entry component on web; checkout renders its own notice instead. */
export const CardField: any = null;

export const useConfirmPayment = () => ({
  confirmPayment: null as null | ((...args: any[]) => Promise<any>),
});

export const initStripe = (_config: { publishableKey: string; merchantIdentifier?: string }) => {
  // No-op: Stripe's mobile SDK has no web implementation.
};
