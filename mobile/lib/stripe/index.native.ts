/**
 * Native (iOS/Android) Stripe SDK surface.
 *
 * Everything the app uses from Stripe is re-exported through here so that no
 * screen imports '@stripe/stripe-react-native' directly. That keeps the
 * native-only dependency confined to files Metro resolves solely on native —
 * see index.ts for why that matters to the web build.
 */
export {
  CardField,
  useConfirmPayment,
  initStripe,
} from '@stripe/stripe-react-native';

export const isStripeAvailable = true;
