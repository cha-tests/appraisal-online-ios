import { useEffect } from 'react';
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { loadStripe, type Stripe as StripeJs, type StripeElements } from '@stripe/stripe-js';

/**
 * Web Stripe surface — real Stripe Elements, not a stub.
 *
 * Metro resolves `index.native.ts` on iOS/Android and this file (the bare
 * `index.tsx`) on web — see index.native.ts's own comment. `@stripe/stripe-
 * react-native` really has no web build, but Stripe.js/React Stripe.js do;
 * this re-implements the same CardField/useConfirmPayment/initStripe
 * surface on top of those instead of leaving web permanently unable to
 * check out (checkout.tsx used to hard-block web the moment
 * isStripeAvailable was false — that notice is gone now that it's true).
 *
 * EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY is meant to be public (it's in the
 * name) — same key already ships to the native bundle today — so inlining
 * it into the web bundle too is not a new exposure.
 */
export const isStripeAvailable = true;

const PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;

let stripePromise: Promise<StripeJs | null> | null = null;
function getStripePromise(): Promise<StripeJs | null> {
  if (!stripePromise) {
    stripePromise = PUBLISHABLE_KEY ? loadStripe(PUBLISHABLE_KEY) : Promise.resolve(null);
  }
  return stripePromise;
}

// No-op: initStripe() is the native SDK's imperative init call (see
// app/_layout.tsx). Stripe.js has no equivalent — it loads itself, lazily,
// the first time CardField actually mounts (see getStripePromise above).
export const initStripe = (_config: { publishableKey: string; merchantIdentifier?: string }) => {};

// useConfirmPayment() is called in checkout.tsx as CardField's *sibling*,
// not its descendant, so there's nowhere in the tree to read an Elements
// context value from. The native SDK's own useConfirmPayment() isn't React
// context either — it reads a native module's global state — so this
// module-level bridge mirrors that shape rather than fighting it with a
// context provider wrapped around the whole checkout screen.
let bridgeStripe: StripeJs | null = null;
let bridgeElements: StripeElements | null = null;

interface CardFieldProps {
  postalCodeEnabled?: boolean;
  placeholder?: { number?: string };
  onCardChange?: (event: { complete: boolean }) => void;
  style?: { backgroundColor?: string; textColor?: string; borderColor?: string };
}

function CardFieldInner({ onCardChange, style }: CardFieldProps) {
  const stripe = useStripe();
  const elements = useElements();

  useEffect(() => {
    bridgeStripe = stripe;
    bridgeElements = elements;
    return () => {
      bridgeStripe = null;
      bridgeElements = null;
    };
  }, [stripe, elements]);

  return (
    <div
      style={{
        padding: '14px 12px',
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: style?.borderColor || '#D1D5DB',
        borderRadius: 8,
        backgroundColor: style?.backgroundColor || '#FFFFFF',
      }}
    >
      <CardElement
        options={{
          hidePostalCode: true,
          style: {
            base: {
              fontSize: '16px',
              color: style?.textColor || '#111827',
              '::placeholder': { color: '#9CA3AF' },
            },
          },
        }}
        onChange={(event) => onCardChange?.({ complete: event.complete })}
      />
    </div>
  );
}

/**
 * Web stand-in for the native SDK's <CardField>. Mounts its own <Elements>
 * provider scoped to just this one field rather than requiring checkout.tsx
 * (or the whole app) to be wrapped in one — keeps the platform split at
 * this module's boundary instead of leaking Stripe.js into every screen.
 */
export function CardField(props: CardFieldProps) {
  if (!PUBLISHABLE_KEY) {
    return (
      <div
        style={{
          padding: 16,
          borderWidth: 1,
          borderStyle: 'solid',
          borderColor: '#DC2626',
          borderRadius: 8,
          backgroundColor: '#FEE2E2',
          color: '#991B1B',
          fontSize: 14,
        }}
      >
        Stripe is not configured for this build (missing
        EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY).
      </div>
    );
  }

  return (
    <Elements stripe={getStripePromise()}>
      <CardFieldInner {...props} />
    </Elements>
  );
}

/**
 * Web stand-in for the native SDK's useConfirmPayment(). Reads the Stripe/
 * Elements instance CardField's <Elements> provider registered via the
 * module-level bridge above, and normalizes Stripe.js's lowercase
 * PaymentIntent status ('succeeded') to the native SDK's capitalized one
 * ('Succeeded') so checkout.tsx's status check works unmodified on both
 * platforms.
 */
export function useConfirmPayment() {
  const confirmPayment = async (
    clientSecret: string,
    _params: { type: 'Card' }
  ): Promise<{ paymentIntent?: { status: string }; error?: { message: string } }> => {
    if (!bridgeStripe || !bridgeElements) {
      return {
        error: { message: 'Card details are not ready yet. Please wait a moment and try again.' },
      };
    }

    const cardElement = bridgeElements.getElement(CardElement);
    if (!cardElement) {
      return {
        error: { message: 'Card details are not ready yet. Please wait a moment and try again.' },
      };
    }

    const result = await bridgeStripe.confirmCardPayment(clientSecret, {
      payment_method: { card: cardElement },
    });

    if (result.error) {
      return { error: { message: result.error.message || 'Card confirmation failed.' } };
    }
    if (!result.paymentIntent) {
      return { error: { message: 'Payment did not complete.' } };
    }

    const status = result.paymentIntent.status;
    return { paymentIntent: { status: status.charAt(0).toUpperCase() + status.slice(1) } };
  };

  return { confirmPayment };
}
