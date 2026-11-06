# Appraisal Online

AI-powered property valuations for consumers, lead generation for real estate
professionals. Launch markets: US and the Philippines.

- **Consumer side (free):** enter an address plus property details, get an
  AI-generated valuation report (in-app view + PDF). After delivery, the
  consumer is asked one question: would they like a local property
  professional to contact them.
- **Broker side (paid):** brokers, lenders and agents buy an annual membership
  to receive leads in their cities.

The full original brief (`Master Prompt for Claude Code` v02, 2026-05-15) is
preserved at `PROJECT_BRIEF.docx`. This file carries only the parts that can't
be re-derived from the code — everything about layout, screens, build order and
the data model lives in the repo itself and should be read there.

## Membership tiers — exact figures, do not round or "simplify"

**Single tier (migration 034, replacing the old Founder Lifetime / Premium
Annual / Basic Annual three-tier model — there is no more "Basic" or
"Lifetime").** DB/code value is still `'Premium Annual'` (kept for schema
continuity, not a meaningful tier name anymore). Every broker gets the same
product: **5 cities, email + push delivered in real time, no SMS, no weekly
digest, 30-day refund window.**

Price is set by **global signup order** (`broker_profiles.signup_rank`,
assigned once at onboarding via `claim_broker_signup_rank`), not by anything
the broker picks, and is computed fresh server-side at every charge
(`get_broker_annual_price(signup_rank, as_of)`) — never trusted from the
client:

| Signup rank | Price through 31 Dec 2026 | Price from 1 Jan 2027 |
|---|---|---|
| 1–1,000 | $9.95/year | $24.95/year |
| 1,001–2,000 | $14.95/year | $24.95/year |
| 2,001+ | $19.95/year | $24.95/year |

- This is **intro pricing, not a lifetime-locked rate**: from Jan 1, 2027
  onward every charge — a brand-new signup or an existing broker's renewal,
  regardless of original rank — is a flat **$24.95/year**. Disclose this at
  signup (e.g. "intro pricing, subject to change") rather than implying the
  signup-day rate is locked in forever.
- **No signup caps of any kind** — open signup, no global broker cap, no
  per-city cap. The old 1,000-broker/30-per-city Founder Lifetime cap system
  and the public `/founders` page that displayed it are both removed.
- There is no separate "founding member" program anymore either — an older,
  already-live ₱5,000/year-locked-for-life system (migration 015) was fully
  retired by migration 034. No real brokers had ever claimed it (test
  accounts only), so it was replaced outright with no grandfathering.

## Critical business rules

- **Free allowance:** 3 consumer reports per calendar month, resetting on the
  1st. The 4th shows a soft paywall pointing at a premium-tier waitlist.
  Deliberate decision (synthetic user report item #7, confirmed with the
  product owner): the cap stays as-is on purpose. Multi-property power users
  (landlords, flippers, Airbnb investors) hit it hardest and are accepted as
  an edge-case cost rather than addressed with a new paid consumer tier or a
  higher cap — the free tier's job is trust-building for first-time
  homeowners, not serving that segment. Don't re-raise this as an open
  question without new input from the user.
- **Refund gate:** the in-app refund flow must check days since payment and
  block out-of-window (30-day) requests with a clear explanation. Track the
  refund rate; alert on the founder dashboard if the rolling 30-day rate
  exceeds 10%.
- **Lead speed gate:** on consumer opt-in, immediately notify every active
  broker in that city via email + push, in real time. There is no weekly
  digest tier anymore, so no digest queue or empty-digest handling applies.
- **AI disclaimer, all three places** (in-app view, email body, PDF): "This is
  a computer estimate. It is not a licensed appraisal. Banks, courts, and
  government agencies do not accept this as a formal valuation."
- **Consent:** no pre-checked boxes, ever. Broker contact requires explicit
  opt-in, separate from phone capture — a consumer's mobile number is
  collected as a required field at account signup itself (used for the
  account, not broker contact), not deferred until after the broker-contact
  opt-in. Email preferences are granular and revocable.
- **Marketing allocation:** monthly per-city budget weighting is proportional
  to active broker count per city (no more per-tier weighting now that
  there's only one tier), published on the internal founder dashboard. The
  signup screen carries the commitment: "We direct our marketing budget to
  your cities for the life of your membership."
- **Compliance:** terms must state the 30-day refund policy and that there
  are no refunds after that window. Privacy policy must satisfy CCPA, GDPR
  and the Philippine NPC.

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
- Other fixed picks: Postmark (transactional email), APNs via Expo (push),
  PostHog (analytics), Google Places (address autocomplete). SendGrid (weekly
  digest) and Twilio (SMS) are no longer used — the single broker tier
  (migration 034) dropped both the digest tier and SMS delivery entirely.

## Never

- Bundle broker-contact consent with terms acceptance — it is a separate,
  explicit opt-in.
- Pre-check a consent checkbox.
- Market lead *volume* or guarantee a number of leads. The platform guarantees
  timing of access and city coverage, nothing about quantity.
- Skip the AI disclaimer in any of its three placements.
- Offer legal advice or legal consultation. Brokers and consumers are
  responsible for their own legal compliance.
- Add a reward/incentive for the broker referral program (migration 030,
  `broker_profiles.referral_code`/`referred_by`) without an explicit request.
  Confirmed decision: it stays attribution-only — there is no incentive for
  referrals right now. Keep the existing referral data/schema; just don't
  build a reward on top of it or fold it into unrelated work.

## Implementation notes (recent work, worth pinning down)

- **A consumer's requested broker count is now enforced at routing
  (migration 032).** `reports.requested_broker_count` (migration 026) used
  to be collected on opt-in and never read — every active, subscribed
  broker in the lead's city got routed the lead regardless of what the
  consumer asked for. `route_lead_to_brokers` now caps routing to that
  count, ranked by earliest active subscription (there's only one tier as of
  migration 034, so the old tier-first ranking no longer applies — see
  "Membership tiers" above). This is "Option A" of two ways
  to enforce the cap — the platform decides up front who gets the lead.
  **Option B — notify every eligible broker and let the first N to
  respond actually connect — was deliberately not built** and is left as
  an open decision for the product owner; it would need a new
  claim/response state on `lead_routings` that doesn't exist today. Don't
  build Option B without an explicit request, and don't treat Option A as
  the final word on this if that decision comes back the other way.
  **Consent/masking requirement if Option B is ever built:** today, the
  moment a broker is routed a lead they see full contact info immediately
  (consumer email/phone, exact address — see `lead-inbox.tsx`/
  `lead-detail.tsx`) because Option A only ever routes to the brokers
  chosen to receive it. Option B cannot reuse that same immediate reveal —
  showing every eligible broker full contact details up front would let
  any of them contact the homeowner directly without ever claiming
  anything, defeating the first-come model and going beyond what the
  homeowner actually consented to (being contacted by a professional
  through the platform, not broadcast to every broker covering their
  city). Option B must show eligible brokers a masked preview only
  (property type, general area, price range — no name/phone/email/exact
  address) until a broker claims the lead, at which point full details
  unlock for that broker only and the lead drops out of/shows as claimed
  for everyone else's inbox.
- **Requested broker count is capped at 5 (migration 035).** Until this,
  `reports.requested_broker_count` (migration 026) had no upper bound at
  all — the broker-contact opt-in screen (`broker-optins.tsx`) only
  rejected zero/blank, so a homeowner could type any number and
  `route_lead_to_brokers` would route the lead to that many brokers. Capped
  client-side (`MAX_REQUESTED_BROKERS` in `broker-optins.tsx`, with a
  "Choose up to 5" helper line) and at the database level (a CHECK
  constraint, since nothing else writes this column). 5 was picked as
  enough for a homeowner to compare real offers without being swarmed by
  calls/texts from a crowd of brokers, in line with what comparable
  real-estate lead platforms (Zillow Premier Agent, realtor.com) cap
  concurrent professional contacts at.
- **Broker signup's country picker is now open to every country** (see
  `mobile/config/countries.ts`'s full ISO list), not gated to PH/US — PH,
  AU and US are pinned to the top, the rest listed alphabetically with a
  search box. This is ahead of `cities` actually being seeded for most of
  them: selecting a country with no cities yet shows an empty state
  ("No cities available yet...") rather than blocking the country from
  being chosen at all. Treat this as the picker being future-ready, not as
  every listed country being an active launch market yet — a broker can
  only actually select cities (and thus receive leads) in a country that
  has real seeded `cities` rows, which today is still just PH (149 cities)
  plus a handful of one-off test cities. `marketConfig.ts`'s separate
  5-country `AUTOCOMPLETE_COUNTRIES` list (US, PH, AU, GB, SG) is unrelated
  — that's consumer-side address search/currency display, not broker
  markets.
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
  confirm password → first name → last name → suffix (optional) → phone.
  Suffix (`users.suffix`, migration 023) is plain free text (Jr., Sr., III,
  etc.), not a fixed dropdown.
- **Broker onboarding has a real Review step** before final submission.
- **The generated PDF report** mirrors the property-details field order
  above, and displays floor/lot area in the property's own market unit
  (sq m or sq ft) instead of a fixed "Square Feet" label.
- **Admin KYC review panel: `web/app/admin`.** Approving/rejecting a
  broker's uploaded ID + selfie used to only be possible by running
  `scripts/review-kyc.ts` by hand with the service-role key — there's now
  an in-app page for it. Gated by `users.is_admin` (migration 024,
  defaults `false` for everyone — there's no self-service way to become an
  admin by design; grant it directly in Supabase's SQL editor). Enforced
  by RLS (new admin-scoped SELECT/UPDATE policies on `broker_profiles` and
  a SELECT policy on the private `kyc-documents` storage bucket), not by
  anything in the page itself — the page is just a client straight
  against Supabase, matching how the rest of the web app already works, so
  the real access boundary is the database, same as everywhere else in
  this schema.
- **KYC photo quality check (`mobile/services/photoQuality.service.ts`)**
  runs on-device right after the ID photo or selfie is captured in broker
  onboarding, and rejects an obviously blurry or glare-washed photo before
  it's ever uploaded. It's a pixel-brightness heuristic (variance of the
  Laplacian for blur; bright-and-locally-flat pixel area for glare), not a
  trained classifier — the blur check is solid (verified against test
  images, huge margin between sharp and blurry), but the glare check
  can't fully tell a reflection apart from a legitimately light-colored
  ID background or a plain white design element, which can score
  similarly; its threshold is set conservatively (only flags a large,
  obvious blowout) to avoid blocking real signups over a false alarm.
  This is a pre-filter for obviously bad photos, not the actual
  gatekeeper — the admin review panel above still makes the final call on
  anything it lets through. Expect both thresholds to need retuning once
  real broker submissions start coming in.

## Known gaps — re-check before every TestFlight build

- **Single-tier pricing model (migration 034) is written and locally
  verified but not yet applied to production.** Replaces the three-tier
  Founder Lifetime / Premium Annual / Basic Annual model with the single
  tier described under "Membership tiers" above: drops the global
  1,000-broker/30-per-city founder cap system and the public `/founders`
  page, drops the old ₱5,000/year-locked-for-life founding-member system
  (migration 015, no real brokers had ever claimed it), simplifies
  `route_lead_to_brokers`/`route_all_orphaned_leads` to no longer rank by
  tier, tightens the `tier` CHECK constraints to `'Premium Annual'` only,
  and adds `broker_signup_seq` / `broker_profiles.signup_rank` /
  `claim_broker_signup_rank(p_user_id)` / `get_broker_annual_price
  (p_signup_rank, p_as_of)`. All mobile/backend/web/scripts code in this
  repo already assumes migration 034 is live — **apply it to production
  before the next broker-facing release**, alongside migration 033 below
  (also still pending).
- **Free-tier monthly cap silently stopped enforcing after a user's first
  month — resolved (migration 033).** `report_allowance` had a bare
  `UNIQUE` constraint on `user_id` alone (001_initial_schema.sql) instead
  of `UNIQUE(user_id, month)`, so a user could only ever have ONE row in
  that table, ever. `increment_report_usage`'s `ON CONFLICT (user_id)`
  matched that same wrong constraint: every report after a user's first
  calendar month of use kept incrementing that one frozen row without
  ever updating its `month` column, so `checkReportAllowance`'s
  month-filtered query could never find it again — the UI showed "0 used
  / 3 remaining" and the app granted unlimited free reports to every
  returning user past their first month. Confirmed live via a real user's
  Account screen (2 reports already generated that month, allowance still
  showing full). Migration 033 fixes the constraint and the function to
  key on `(user_id, month)`, and rebuilds `report_allowance` from the
  `reports` table (the source of truth, never affected by this bug) since
  every existing row was corrupted and unrecoverable as-is. Verified
  against a local Postgres replay of all 33 migrations with a realistic
  multi-month report history before shipping. **Apply this migration to
  production as a priority** — it's the only thing actually enforcing the
  3-report cap CLAUDE.md commits to.
- **Orphaned lead backlog — resolved (migration 028).** Root cause (fixed
  earlier): broker onboarding never persisted `broker_profiles.selected_cities`
  to the database at all, so `route_lead_to_brokers` (migration 008) never had
  anything real to match. `onboarding.tsx`'s `handleSubmit` now calls
  `brokerService.updateCities`, and migration 027's
  `route_orphaned_leads_to_broker` retroactively routes any lead with zero
  `lead_routings` rows the moment *that broker* saves a matching city — but
  that only fired on that one event, leaving two gaps: a lead stuck before
  027 shipped, and an existing broker who already covers a city but never
  touches their city list again. Migration 028 closes both: a
  `route_all_orphaned_leads()` sweep (same routing logic, run across every
  orphaned lead and every active broker at once) is called once immediately
  in the migration to clear the existing backlog, and scheduled hourly via
  `pg_cron` so a future stuck lead gets caught up on its own. Applied to the
  real project and confirmed live: the one-time backfill routed 7 real stuck
  leads, and `cron.job` shows `route-orphaned-leads-hourly` scheduled and
  `active = true`. Nothing left open on this one.

## Companion documents and precedence

Ask specific questions rather than guessing. When these conflict:

- **Monetization Model v05** wins on business logic.
- **Feature Specifications v02** wins on data model and integrations.
- **Wireframes v02** wins on visual layout.
