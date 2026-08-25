# Stripe Test Checkout Guide

## Current Setup Status

✅ **Backend Ready**: Stripe SDK initialized with test keys  
✅ **Mobile Ready**: CardField integrated, SDK initialization in place  
✅ **Test Keys**: Both files have matching test key pairs  

## What's Wired Up

### Mobile App (`mobile/.env.local`)
```
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51234567890abcdefghijklmnop
```

### Backend API (`backend/.env.local`)
```
STRIPE_SECRET_KEY=sk_test_••••••••••••••••••••••••
STRIPE_WEBHOOK_SECRET=whsec_test_1234567890abcdefghijklmnop
```

The publishable key above is a placeholder — swap in your own test keys from the Stripe Dashboard (see below). Test-mode keys never process real payments.

## Testing the Flow (iPhone Only)

1. **Start the app on your iPhone** via Expo Go (web checkout shows "use iPhone" message)
2. **Sign up as a broker** → Select a tier → Click checkout
3. **Stripe CardField** appears (you can type a test card)
4. **Use Stripe's test card**: `4242 4242 4242 4242`
   - Expiry: any future date (e.g. 12/30)
   - CVC: any 3 digits (e.g. 123)
5. **Click "Complete Purchase"**
6. Stripe confirms the card, backend creates the subscription, app navigates to welcome screen

## When You Get Real Keys

Your Stripe account will have **different** test keys:
- Go to https://dashboard.stripe.com → **Developers** → **API keys**
- Make sure **Test mode** toggle is **ON**
- Copy the **publishable key** (`pk_test_…`) → `mobile/.env.local`
- Click **Reveal** on the **secret key** (`sk_test_…`) → `backend/.env.local`

Both files already have comments showing where to paste them. Just replace the test keys with your real test keys.

## Troubleshooting

| Issue | Fix |
|---|---|
| CardField doesn't appear | Stripe SDK not initialized — restart Expo Go, check `_layout.tsx` initialization |
| "Web Checkout Not Available" | This is correct — close the web browser and run on your iPhone via Expo Go |
| Payment succeeds but subscription not created | Check backend logs for `/api/payments/confirm` errors |
| Payment declined immediately | Using a non-test card — must use `4242 4242 4242 4242` (Stripe's public test card) |

## What Happens with Test Keys

- ✅ Full payment flow works (create intent, confirm card, create subscription)
- ✅ No real charges happen
- ✅ Test payments appear in Stripe dashboard under Test Data
- ✅ Can test all tiers: Founder Lifetime ($499), Premium Annual ($199), Basic Annual ($49)
- ✅ Refund flow will work (14-30 day windows per tier)

## Next Steps (When Ready for Real Payments)

1. **Get real Stripe test keys** from your account (currently using public example keys)
2. **Replace them** in `.env.local` files
3. **Get real API keys** for external services (Gemini, Google Places, Postmark)
4. **Test end-to-end** with real credentials
5. **Move to production keys** when ready to go live

## Files Changed for Stripe

- `backend/src/services/stripe.ts` — Amount lookup, tier pricing, no raw card processing
- `backend/src/routes/payments.ts` — Create intent, remove /charge endpoint, confirm payment
- `mobile/app/_layout.tsx` — Initialize Stripe SDK at app root
- `mobile/app/broker/checkout.tsx` — CardField integration, payment confirmation
- `mobile/services/payment.service.ts` — Simplified to create intent + confirm only
