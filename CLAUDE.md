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
product: **5 cities, email delivered in real time, no SMS, no weekly
digest, 30-day refund window.** (Push was dropped from this product entirely
— see "Implementation notes" below; email is the only real-time channel.)

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
  broker in that city via email, in real time. There is no weekly digest tier
  anymore, so no digest queue or empty-digest handling applies. Push was
  never built (no token capture, no send pipeline — see "Implementation
  notes"); do not reintroduce it into any in-app copy without a new,
  explicit request.
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
- Other fixed picks: Postmark (transactional email), PostHog (analytics),
  Google Places (address autocomplete). SendGrid (weekly digest) and Twilio
  (SMS) are no longer used — the single broker tier (migration 034) dropped
  both the digest tier and SMS delivery entirely. Push (APNs via Expo) was
  never built at all — a confirmed decision, not a gap — email is the only
  real-time delivery channel; see "Implementation notes."

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

- **Claim-based lead routing is being built, replacing immediate full
  reveal — Phase 1 (database foundation, migration 037) is written and
  locally verified, NOT yet applied to production.** This is a hybrid of
  what used to be documented here as "Option A" (the platform pre-selects
  `requested_broker_count` brokers, ranked by earliest active subscription
  — unchanged) and "Option B" (brokers must actively claim a lead before
  seeing contact info — now the reveal mechanism for those chosen
  brokers, rather than a separate everyone-in-the-city race). The
  `route_lead_to_brokers`/`route_all_orphaned_leads` selection logic
  itself is untouched; what changes is that a routed broker now sees only
  a masked preview (property type, general area, price range, condition,
  lead tags — no name/phone/email/exact address) until they tap "I want
  this lead," enforced at the RLS layer via `lead_routings.claim_status`
  (not just hidden in the UI — see migration 037's tightened policies on
  `leads`/`properties`/`reports`/`users` and the new
  `get_my_lead_routings()` function, the only place PII is ever selected
  conditionally). **Escalation**: if not enough of the originally-routed
  brokers claim, the pool widens on its own — while zero have claimed,
  check every 24h and invite 1 more; once at least one has claimed, check
  every 48h and invite as many new brokers as there are still-open slots
  (`escalate_lead_routing`/`escalate_all_pending_leads`, hourly via
  pg_cron, same pattern as `route_all_orphaned_leads`). Nobody already
  invited is ever removed — they can still claim anytime until every slot
  fills. **Why this needed a quota check inside `claim_lead()` itself**:
  because non-responders are never dropped, the invited pool can exceed
  `requested_broker_count` once escalation has run — without the check,
  several of them claiming around the same time could push a lead's
  claimed count past what the homeowner actually asked for (`claim_lead`
  uses `pg_advisory_xact_lock` to make the quota check atomic; caught by a
  local test before this shipped). **Revoke** (`revoke_broker_contact`)
  is per broker, not per lead: a broker who hasn't claimed yet is just
  silently dropped (they never had any contact info, nothing to revoke);
  one who has already claimed keeps their `lead_routings` row but marked
  `'revoked'` (distinct from broker-marked `'lost'`) — this cannot force a
  broker who already has a homeowner's phone number to stop contacting
  them (no platform can enforce that once contact info is shared), so the
  real teeth has to come from a later phase's broker-ToS consequence for
  ignoring it, not from this migration alone. Every revoke is logged with
  a reason (`broker_contact_revocations` — decided_not_to_sell /
  changed_mind / not_satisfied_with_appraisal / found_own_professional /
  other) for the same kind of revoke-rate-by-reason visibility the
  existing refund-rate tracking already gives. `leads.status` is dropped
  entirely — status is now per-broker on `lead_routings`
  (new/contacted/in_talks/converted/lost/revoked, broker-settable except
  `revoked`) since one lead can now have several brokers independently
  making progress.
  **Phase 2 (broker-side UI) is done** — `lead-inbox.tsx`, `lead-detail.tsx`,
  and `dashboard.tsx`'s Recent Leads preview all now read through
  `get_my_lead_routings()` (migration 038 extended it with
  `claimed_count`/`requested_broker_count`, so an invited-but-unclaimed row
  can tell "still open" from "already filled by others" — needed for the
  "This lead has already been connected with enough professionals" state
  — plus `is_owner`/`intends_to_sell`/`title_url`/`comparables`, which
  lead-detail.tsx needed and the original migration 037 function didn't
  expose yet). Masked cards show property type/area/price-range/condition/
  lead-tags with a plain "I Want This Lead" button; claimed cards are the
  full original detail view. The 5-state pipeline (New/Contacted/In
  Talks/Converted/Lost, `config/leadRoutingStatus.ts` for shared labels)
  replaces the old 3-state one, with a canned reason picker
  (`config/lostReasons.ts`) on marking a lead Lost, mirroring the
  homeowner's own revoke reasons. A revoked lead shows a dedicated banner
  instead of the normal status actions. Verified against mocked RPC
  responses via a web export screenshot (masked, claimed, and
  already-full states, plus the dashboard preview) — caught and fixed one
  real layout bug this way (the horizontal filter-pill row was stretching
  to fill the screen's height because the ScrollView itself had no
  `flexGrow: 0`).
  **Dashboard's "Lead Pipeline" widget** (`broker/dashboard.tsx`) shows a
  real per-status count across the broker's full `get_my_lead_routings()`
  result — not just the 5-item Recent Leads preview below it — as six
  tappable chips (New/Contacted/In Talks/Converted/Lost/Revoked), each
  deep-linking into `lead-inbox.tsx` pre-filtered to that status via a
  `?status=` query param `lead-inbox.tsx` now reads on mount. This is
  real data, unlike the three KPI cards above it (Leads This Month,
  Conversion Rate, Avg Lead Value), which are still `metrics` placeholder
  values (`// Calculate metrics (mock data for now)`) — untouched here,
  out of scope for this change. Verified via a mocked-RPC web export
  screenshot (9 routings across all 6 statuses rendering the right
  counts) and a second screenshot confirming the `?status=in_talks` deep
  link actually pre-selects that filter pill on load.
  **Phase 3 (consumer-side UI) is done** —
  `consumer/settings.tsx`'s "Broker Contact" section now reads through
  `get_my_connected_brokers()` (migration 039 — mirrors
  `get_my_lead_routings()` but for the homeowner side: one row per
  `lead_routings` entry across every lead they've created, carrying the
  routed broker's public listing info — company/own name, not sensitive,
  it's what the broker's own profile already shows — rather than the
  homeowner's own PII, which they obviously already have). Grouped by
  property, one sub-row per routed broker in plain language
  (`consumerLeadStatusLabel` in `config/leadRoutingStatus.ts` — "Waiting
  to hear back," never raw terms like `in_talks`), each with its own
  Revoke action and canned reason picker (`config/revokeReasons.ts`,
  values matching `broker_contact_revocations.reason`'s CHECK exactly) —
  plus a "Cancel entire request" action per property that revokes every
  routed broker for that lead in one pass
  (`reportService.cancelRequestForLead`, loops `revoke_broker_contact`
  since each row's revoke is already independent, no new RPC needed).
  Cancelling also flips `reports.broker_contact_opted_in` to false, which
  matters beyond the UI: `escalate_all_pending_leads`/
  `route_all_orphaned_leads` both gate on that flag, so skipping it would
  have let escalation keep inviting new brokers to a lead the homeowner
  had just cancelled. The **check-in prompt** ("Still waiting to hear
  back... keep waiting, or cancel?") shows per property when every routed
  broker is still `claim_status = 'invited'` (nobody's claimed yet) and
  the earliest invite was `CHECK_IN_DAYS` (5) or more days ago — computed
  client-side from existing data, no new backend infra; "Keep waiting"
  only dismisses it for the current session, nothing persisted.
  `report.service.ts`'s `updateBrokerOptIn` revoke branch (still the path
  for the initial-decline flow, where it's always a no-op) now calls
  `cancelRequestForLead` instead of writing to the dropped `leads.status`
  column. Verified against mocked RPC responses via a web export
  screenshot (check-in banner, per-broker statuses including a revoked
  one with no Revoke button, and the reason picker actually opening).
  **Phase 4 (notifications) is done** — email only for now (push doesn't
  exist anywhere in this codebase yet — no token capture, no sending
  code — so it was out of scope for this phase); a backend poller, not
  pg_net or Edge Functions, drains the queue (see migration 040's header
  comment for why). `notification_queue` (migration 040) is a Postgres
  outbox: three triggers on `lead_routings` (`AFTER INSERT` for
  `broker_invite`, `AFTER UPDATE OF claim_status` for
  `broker_missed_lead` — fires once a claim fills every requested slot,
  to every other still-invited broker on that lead — and
  `AFTER UPDATE OF status` for `broker_stop_contact` on a revoke of an
  already-claimed row) plus `queue_consumer_check_ins()`, the email/push
  equivalent of `consumer/settings.tsx`'s in-app check-in banner, same
  5-day threshold and once-per-lead-ever guard, on its own daily pg_cron
  job (`queue-consumer-check-ins-daily`, separate from the hourly
  `escalate-lead-routings-hourly` job so either can be retimed alone). No
  RLS policies at all on the table on purpose — only the service-role key
  the backend already uses can touch it. `backend/src/services/email.ts`
  gained four Postmark-backed senders (`sendBrokerInviteEmail`,
  `sendBrokerMissedLeadEmail`, `sendBrokerStopContactEmail` — carries
  explicit ToS-violation language, since revoke can't technically stop a
  broker who already has the homeowner's number — `sendConsumerCheckInEmail`),
  and the new `backend/src/services/notificationPoller.ts` polls every 2
  minutes (`setInterval`, started from `index.ts` alongside `app.listen`),
  batches 25 pending rows at a time, sends via the matching function, and
  marks each row sent/failed — best-effort, no retry loop, matching
  `lead_routings.delivery_status`'s existing pending/sent/failed/bounced
  pattern.
  **Migrations 037/038/039/040 are now written and locally verified, with
  both the broker and consumer sides of the app ready for them** — still
  not yet applied to production (see "Known gaps").
- **Data-dependent screens now time out instead of spinning forever**
  (`services/withTimeout.ts` + `components/ui/LoadError.tsx`). A QA audit
  found that Broker Dashboard, Lead Inbox, Broker Settings, Consumer
  Settings (both its main preferences load and its Broker Contact
  sub-section), Consumer Account, and the public Coverage page ("Is Your
  City Covered?") all stayed on their loading spinner indefinitely if the
  backend call hung rather than erroring quickly — a `catch`/`finally`
  only helps once a promise actually rejects, and a request to a
  genuinely unreachable host can just never settle. `withTimeout(promise,
  ms = 12000)` races any promise/thenable (including Supabase's
  `PostgrestFilterBuilder`) against a 12s ceiling and rejects with
  `LoadTimeoutError` if it's not back by then; each screen now has a
  `loadError` state + a `reloadToken` bumped by `LoadError`'s Retry
  button, which re-runs the same load effect rather than duplicating its
  body. Consumer Settings' Broker Contact sub-section gets a lighter
  inline "Couldn't load this section — Retry" row instead of replacing
  the whole screen, since the rest of the page (notification toggles)
  still works fine even if that one RPC call fails; that fix also closed
  a second, smaller pre-existing bug where `getMyConnectedBrokers()`
  returning `success: false` was silently treated as "no connected
  brokers" instead of surfacing as a real error. Verified via a web
  export screenshot with `supabase.rpc` mocked to a promise that never
  resolves — confirms the dashboard correctly flips to the Retry UI
  after the 12s ceiling instead of hanging. The same audit's three other
  findings — the Lead Inbox header showing "0 leads" while still
  loading, the broker-contact toggle only responding to the switch
  itself, and a signed-out visitor hitting `/broker/splash` or
  `/broker/welcome` landing on a bare login form — were already fixed in
  an earlier commit (`869731c`), confirmed still in place when re-checked
  here. Its remaining finding — resolved — was two different AI-disclaimer
  versions: `public/sample-report.tsx` hardcoded just
  `AI_ESTIMATE_DISCLAIMER_TEXT` inline instead of importing it, and never
  showed `CLIENT_DISCLAIMER_TEXT` (the broker-license-verification/PRC
  disclaimer) at all, despite also showing a Sample Broker Profile card on
  the same page. `config/disclaimers.ts`'s own header comment is explicit
  that both disclaimers are current and meant to coexist (confirmed by
  `report-view.tsx`, which already shows both) — this wasn't a "which
  version is current" ambiguity, just an omission on the one page that
  never got the second disclaimer. Fixed by importing both constants and
  rendering them through the shared `DisclaimerNotice` component (same as
  `report-view.tsx`): the AI disclaimer stays where it was, and the
  broker-verification one (with its PRC link) now sits right under the
  Sample Broker Profile card. Verified via a web export screenshot. The
  audit also referenced a "Founder Membership" page, which no longer
  exists at all (removed by migration 034) — stale by the time the audit
  ran. `sample-report.tsx`'s other retired-tier content is also now
  cleaned up: the "Sample Weekly Digest (Basic)" section is removed
  entirely (card + now-unused `digest*` styles), "Sample Lead Alert
  (Premium/Founder)" is now just "Sample Lead Alert", and the "Founder
  Member" badge on the Sample Broker Profile card is gone (no badge at
  all now, matching the single-tier model — there's no meaningful tier
  distinction left to badge). Verified via `tsc --noEmit` and a web
  export screenshot.
- **Requested broker count has no hard cap (migration 036 reversed
  migration 035's 5-max).** MVP decision: trust the homeowner rather than
  block them. `broker-optins.tsx` still rejects zero/blank (a real choice
  is required), and above `LARGE_REQUEST_CONFIRM_THRESHOLD` (10) shows a
  confirm dialog ("most homeowners choose far fewer — continue with N?")
  rather than refusing the number outright — catches a likely typo without
  imposing a business ceiling. The database constraint was loosened to
  match: just `>= 1` (migration 036), no upper bound. `route_lead_to_brokers`
  itself has no cap of its own either way — it just `LIMIT`s to whatever
  `requested_broker_count` says.
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

- **Account deletion and personal-data export (migrations 041/042) are
  written and locally verified but NOT applied to production.** Closes two
  of the pre-launch gaps identified this session (account deletion is also
  a literal App Store Guideline 5.1.1(v) requirement). Built and
  independently verified as a multi-agent gauntlet run; see each
  migration's own header comment for full design/decision notes rather than
  re-deriving them here.
  - **`delete_my_account()`** (041): real deletion for both account types.
    Anonymizes (scrubs identifying fields, keeps the row) anything with
    audit/history value to the OTHER party — a claimed lead's property/
    report fields, a routed-but-deleted broker's `lead_routings` row — and
    hard-deletes everything only the deleting user themselves could see.
    The `users` row itself is never deleted, only scrubbed to a
    `deleted-<id>@deleted.invalid` placeholder, since deleting it would
    cascade and destroy exactly the rows kept for the other party's
    history. Idempotent (safe to call twice). Backend
    (`accountDeletion.service.ts`) additionally clears Storage KYC/photo
    objects and deletes the real login via the Admin API — things no DB
    function can do.
    - **Open decision, not yet resolved**: a broker's claimed-lead slot is
      never refilled by escalation after their account is deleted, because
      of a pre-existing mismatch between `claim_lead()` (counts revoked
      claimed rows toward quota) and escalation (excludes them) from
      migration 037. A homeowner who asked for one broker and whose broker
      later deletes their account is left permanently short. Needs
      `claim_lead()`'s quota counting fixed before this can be addressed.
    - **Open decision, not yet resolved**: whether keeping a scrubbed
      `users` placeholder row (rather than deleting the row outright)
      satisfies GDPR/CCPA/NPC "right to erasure." Treated as yes for now
      (identifying fields are genuinely cleared), but the privacy policy
      should say explicitly that anonymized lead history and financial
      records are retained — don't finalize that copy without confirming
      this holds up.
  - **`export_my_data()`** (042): a single jsonb bundle of everything the
    calling user owns. Reuses `get_my_lead_routings()`/
    `get_my_connected_brokers()` verbatim for anything cross-user, rather
    than re-deriving the masking rule, so the export can't drift out of
    sync with what the app already shows. Deliberately excludes a
    broker-named `broker_contact_revocations` row's reason/note (brokers
    can't see these in-app either) and `notification_queue` (no app access
    at all, duplicate data).
    - **Separate finding, not an export question — real schema drift**:
      `consumer/settings.tsx` reads a `users.preferences` column that no
      migration from 001 onward ever creates. Either production has it
      added outside migration history, or that query is silently failing
      today. Worth its own investigation.
- **Claim-based lead routing (migrations 037/038/039/040) is written and
  locally verified but NOT applied to production.** See "Implementation
  notes" above for the full design. All four phases (Phase 1 DB
  foundation, Phase 2 broker-side UI, Phase 3 consumer-side UI, Phase 4
  notifications) are now done and the app fully assumes the new schema on
  both sides — there's no longer a known reason to hold this back once
  applied; the usual review before running a migration against
  production still applies, same as any other. The backend also needs a
  deploy/restart to pick up the new notification poller once 040 is
  applied, since the poller queries a table that doesn't exist until
  then.
- **Single-tier pricing model — resolved (migration 034), applied and
  confirmed live in production.** Replaced the three-tier Founder Lifetime
  / Premium Annual / Basic Annual model with the single tier described
  under "Membership tiers" above: dropped the global 1,000-broker/30-
  per-city founder cap system and the public `/founders` page, dropped the
  old ₱5,000/year-locked-for-life founding-member system (migration 015,
  no real brokers had ever claimed it), simplified
  `route_lead_to_brokers`/`route_all_orphaned_leads` to no longer rank by
  tier, tightened the `tier` CHECK constraints to `'Premium Annual'` only,
  and added `broker_signup_seq` / `broker_profiles.signup_rank` /
  `claim_broker_signup_rank(p_user_id)` / `get_broker_annual_price
  (p_signup_rank, p_as_of)`. The first production run hit a bug the
  migration didn't account for — real test-account rows already existed
  under the retired tier names, which the tightened CHECK rejected
  outright — fixed by backfilling every existing row to `'Premium Annual'`
  (and backfilling `signup_rank` for those same pre-existing brokers,
  ordered by `created_at`, since onboarding only claims a rank for a
  brand-new signup) before adding the constraint. Re-ran clean afterward;
  confirmed live via `pg_constraint`.
- **Requested broker count's hard cap (migration 035) was reversed —
  resolved (migration 036), applied and confirmed live in production.**
  See "Implementation notes" above for the current behavior (no hard max,
  confirm dialog above 10). Migration 035 itself is still correctly
  applied/live — 036 only loosens the constraint it added, doesn't undo
  the column or the rest of it. Confirmed live via `pg_constraint`: only
  `reports_requested_broker_count_positive` exists on `reports`, the old
  `reports_requested_broker_count_range` is gone.
- **Free-tier monthly cap silently stopped enforcing after a user's first
  month — resolved (migration 033), applied and confirmed live in
  production.** `report_allowance` had a bare `UNIQUE` constraint on
  `user_id` alone (001_initial_schema.sql) instead of
  `UNIQUE(user_id, month)`, so a user could only ever have ONE row in
  that table, ever. `increment_report_usage`'s `ON CONFLICT (user_id)`
  matched that same wrong constraint: every report after a user's first
  calendar month of use kept incrementing that one frozen row without
  ever updating its `month` column, so `checkReportAllowance`'s
  month-filtered query could never find it again — the UI showed "0 used
  / 3 remaining" and the app granted unlimited free reports to every
  returning user past their first month. Confirmed live via a real user's
  Account screen (2 reports already generated that month, allowance still
  showing full). Migration 033 fixed the constraint and the function to
  key on `(user_id, month)`, and rebuilt `report_allowance` from the
  `reports` table (the source of truth, never affected by this bug) since
  every existing row was corrupted and unrecoverable as-is. Verified
  against a local Postgres replay of all 33 migrations with a realistic
  multi-month report history before shipping, and confirmed live via
  `pg_constraint` after applying.
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
