# Gemini Valuation — Findings & Decisions (2026-08-26/27)

Summary of a conversation working through how AI property valuations are
generated, what's actually implemented in this app already, and what's left
to do before launch.

## How the valuation actually works today

1. Consumer fills in property details (bedrooms, bathrooms, size, condition,
   etc.) — all dropdowns/numbers, no free text.
2. `mobile/services/report.service.ts` builds a prompt asking Gemini for a
   JSON valuation (estimated value, confidence range, reasoning, market
   trends), then calls Google's Gemini API directly from the phone.
3. If no API key is set, or the Gemini call fails, it silently falls back to
   `generateMockValuation()` — a simple formula based on comparable sale
   prices adjusted for size/bedrooms/condition. The result carries
   `is_mock: true` so it's never shown to the user as if it were real.
4. The report is saved to Supabase and displayed in the app.

## Known gaps

- **Comparable sales are 100% hardcoded** (`mobile/app/consumer/loading.tsx`,
  `mockComparables`). Every property, everywhere, gets the same three fake
  comps ("456 Oak Ave", "789 Elm St", "321 Pine Rd"). This means even a
  perfectly working Gemini call is reasoning from fake data. **Needs a real
  comps data source before the valuation means anything** — a paid comps API,
  or manually-sourced data for the PH launch cities. This is a business/data
  decision, not something fixable in code alone.
- **PDF generation and email delivery are backend-side already** (`pdf.ts`,
  `email.ts` via Postmark) — no gap here, unlike the old Google Apps Script
  prototype this app was compared against.

## Resolved during this conversation

- **Gemini key format confusion.** Google switched Gemini API keys from the
  old `AIzaSy...` format to a new `AQ.Ab...` format (~mid-2026 migration).
  The key already in `mobile/.env.local` was NOT a broken placeholder — `AQ.`
  is the current legitimate format. Saved as a standing memory so this isn't
  re-flagged as broken in the future.
- **"Prepayment credits depleted" error.** The original key was valid but the
  Google account had no funded billing balance, so every real call failed and
  the app silently used the mock fallback. A new key
  (redacted — see `mobile/.env.local`, not committed) was generated and
  tested live — confirmed working, returns real Gemini-generated valuations.
  Updated in `mobile/.env.local`.

## Security: Gemini key exposed in the mobile app bundle

`EXPO_PUBLIC_*` environment variables ship inside the compiled app — anyone
who inspects the app could extract the Gemini key and use it on your Google
account's dime. Google Places already avoids this by proxying calls through
the backend (`backend/src/routes/places.ts`); Gemini didn't.

**Decision: build the fix now, don't switch it on yet.**

- Added `backend/src/services/gemini.ts` and `backend/src/routes/valuation.ts`
  — a new `POST /api/valuation/generate` endpoint, auth-protected, that runs
  the same prompt/Gemini logic server-side.
- Added `GEMINI_API_KEY` to `backend/.env.local` and `.env.example`.
- Tested end-to-end with a real test-account login: returns a genuine
  Gemini-generated valuation, and correctly rejects unauthenticated requests
  (401).
- **The mobile app has NOT been switched over to use this endpoint.** It
  still calls Gemini directly, same as before — nothing changes for you day
  to day.

**Why not switch it on immediately:** the backend only runs on this dev
machine's LAN address (`192.168.4.67:3001`, per the comment in
`mobile/.env.local`). Proxying through it would work while testing on the
same Wi-Fi, but silently break on any real device (TestFlight, production)
that isn't on that network — the same reason Google Places is only proxied
for the web build, not native. Actually protecting the Gemini key requires
deploying the backend somewhere with a permanent public address first.

**Next step, whenever you're ready to deploy:** point `report.service.ts` at
`POST {API_URL}/api/valuation/generate` instead of calling Gemini directly,
then remove `EXPO_PUBLIC_GOOGLE_GEMINI_API_KEY` from the mobile app entirely.
Small change — a few minutes once the backend has a real host.

## Hosting recommendation (for deploying the backend)

| Option | Verdict |
|---|---|
| **Railway** | Top pick — simplest git-push deploy, ~$5/mo always-on, least setup |
| **Render** | Close second — has a Singapore region (closer to PH users), but the free tier spins down when idle; use the paid Starter tier (~$7/mo) for always-on |
| **Fly.io** | More control (multi-region), more setup — worth it later if expanding beyond PH |
| Vercel | Skip — built for short-lived serverless functions (time limits as low as 10s), not a persistent Express server; Gemini calls can run long enough to get cut off |
| AWS / GCP / Azure | Skip for now — powerful but requires manually configuring networking, permissions, storage, etc.; more surface area to misconfigure than a small team needs at this stage |

**Recommendation: start with Railway.** Switch to Render if PH response speed
turns out to matter more than expected once real users are on it.
