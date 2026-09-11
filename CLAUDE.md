# Appraisal Online

AI-powered property valuations for consumers, lead generation for real estate
professionals. Launch markets: US and the Philippines.

- **Consumer side (free):** enter an address plus property details, get an
  AI-generated valuation report (in-app view + PDF). After delivery, the
  consumer is asked one question: would they like a local property
  professional to contact them.
- **Broker side (paid):** brokers, lenders and agents buy an annual membership
  or a one-time lifetime pass to receive leads in their cities.

The full original brief (`Master Prompt for Claude Code` v02, 2026-05-15) is
preserved at `PROJECT_BRIEF.docx`. This file carries only the parts that can't
be re-derived from the code — everything about layout, screens, build order and
the data model lives in the repo itself and should be read there.

## Membership tiers — exact figures, do not round or "simplify"

| Tier | Price | Cities | Delivery | Refund window |
|---|---|---|---|---|
| Founder Lifetime | $499 one-time | 25 | email + push + SMS, real-time | **14 days, then never** |
| Premium Annual | $199/year | 10 | email + push, real-time | 30 days, then not until next renewal |
| Basic Annual | $49/year | 1 | email only, weekly digest | 30 days, then not until next renewal |

- Lifetime is capped at the first **1,000 brokers globally**, with a per-city
  sub-cap of **30 lifetime founders**, enforced from day one.
- Lifetime has **no sunset clause and no pro-rata refund** — that was removed
  in Monetization Model v05. The 14-day guarantee is its only protection.
- Lifetime is positioned as a "founder pass to Premium", never as equivalent
  to Premium Annual.

## Critical business rules

- **Free allowance:** 3 consumer reports per calendar month, resetting on the
  1st. The 4th shows a soft paywall pointing at a premium-tier waitlist.
- **Refund gate:** the in-app refund flow must check tier *and* days since
  payment, and block out-of-window requests with a clear explanation. Track
  refund rate split by tier; alert on the founder dashboard if the rolling
  30-day rate exceeds 10% for any tier.
- **Per-city founder cap:** when a broker selects Lifetime, reject any city
  already at 30 founders. The counter is visible during signup and on a
  public `/founders` page that updates in real time.
- **Lead speed gate:** on consumer opt-in, immediately notify all Lifetime and
  Premium brokers in that city via their chosen channels, and queue the lead
  for that city's basic weekly digest. The digest fires **Mondays at 9 AM
  local time**, covering the previous Monday–Sunday.
- **Empty-digest safeguard:** if a city had fewer than 3 reports that week,
  supplement with curated regional market intelligence. Basic members must
  never receive an empty digest.
- **AI disclaimer, all three places** (in-app view, email body, PDF): "This is
  a computer estimate. It is not a licensed appraisal. Banks, courts, and
  government agencies do not accept this as a formal valuation."
- **Consent:** no pre-checked boxes, ever. Broker contact requires explicit
  opt-in. Phone capture is optional and only requested *after* the consumer
  agrees to broker contact. Email preferences are granular and revocable.
- **Marketing allocation:** monthly per-city budget weighting is
  Lifetime × 3 + Premium × 2 + Basic × 1, published on the internal founder
  dashboard. Lifetime and Premium signup screens carry the commitment: "We
  direct our marketing budget to your cities for the life of your membership."
- **Compliance:** terms must state the tier-specific refund policy and that
  there are no refunds after each window. Privacy policy must satisfy CCPA,
  GDPR and the Philippine NPC.

## Locked choices — do not substitute

These are decisions, not defaults, and each has a reason that isn't visible
from the code:

- **AI valuation: Google Gemini 2.5 Flash.** Chosen for continuity with the
  existing Apps Script pipeline, lower latency and predictable pricing.
- **Backend: Supabase.** It *replaces* the Google Apps Script + Sheets
  pipeline — never reintroduce those as backend.
- **Broker payments: Stripe directly, not Apple IAP.** B2B subscriptions for
  property professionals are permitted to use external payment; Apple's IAP is
  for consumer purchases.
- **Comparables:** US — RealtyMole (primary), ATTOM Data (secondary).
  Philippines — Lamudi public-listings parser + zip-code baselines.
- Other fixed picks: Postmark (transactional email), SendGrid (weekly digest),
  APNs via Expo (push), Twilio (SMS, Lifetime only), PostHog (analytics),
  Google Places (address autocomplete).

## Never

- Bundle broker-contact consent with terms acceptance — it is a separate,
  explicit opt-in.
- Pre-check a consent checkbox.
- Market lead *volume* or guarantee a number of leads. The platform guarantees
  timing of access and city coverage, nothing about quantity.
- Skip the AI disclaimer in any of its three placements.
- Sell Lifetime into a city at its 30-founder cap.
- Send an empty weekly digest.
- Offer legal advice or legal consultation. Brokers and consumers are
  responsible for their own legal compliance.

## Implementation notes (recent work, worth pinning down)

- **Broker launch markets stay US/PH only.** `mobile/config/marketConfig.ts`
  additionally wires up Australia, UK and Singapore, but only for the
  *consumer* side — address-search autocomplete, size-unit/currency
  display, phone country codes (`AUTOCOMPLETE_COUNTRIES`). Broker
  signup's city picker (`broker/onboarding.tsx`) still only offers PH/US
  cities, matching "Launch markets" above. Don't read that 5-country list
  as an expansion of broker markets — it's consumer-side convenience only
  (a homeowner there can still get a valuation in their own
  currency/units), and any AU/UK/SG "broker" accounts are test data, not a
  real rollout.
- **Property type is one universal list** across every market — House,
  Apartment/Unit, Townhouse, Villa, Condo, Vacant Land, Others
  (`PROPERTY_TYPES` in `marketConfig.ts`) — replacing what used to be a
  different list per country, since the app only actually ships two
  markets and the per-country lists added complexity without real value.
- **"Tell us about the property" (consumer form)** is ordered Property
  Type → Layout (Bedroom(s)/Bathroom(s)/Parking) → Size (Lot Area/Floor
  Area) → State (Condition/Year Built), with no default bedroom/bathroom
  count (starts at 0) and no default Condition (a required selection, not
  a "Good" default).
- **Signup forms (broker + consumer)** are ordered email → password →
  confirm password → first name → last name → phone.
- **Broker onboarding has a real Review step** before final submission,
  and a Free-tier signup shows "Submit" instead of "Continue to Payment".
- **The generated PDF report** mirrors the property-details field order
  above, and displays floor/lot area in the property's own market unit
  (sq m or sq ft) instead of a fixed "Square Feet" label.
- **Known discrepancy, unresolved:** broker onboarding's `TIER_DETAILS`
  (`broker/onboarding.tsx`) currently displays Premium Annual as
  "₱5,000/year" and Basic Annual as "Free" — not the $199/year and
  $49/year figures in the tiers table above. Not yet resolved either
  direction (update the table to match, or revert the onboarding screen)
  — flag before shipping.

## Companion documents and precedence

Ask specific questions rather than guessing. When these conflict:

- **Monetization Model v05** wins on business logic.
- **Feature Specifications v02** wins on data model and integrations.
- **Wireframes v02** wins on visual layout.
