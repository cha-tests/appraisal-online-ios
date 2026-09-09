# Report Generation, Currency, and Address Precision Fixes

**Date:** 2026-09-01 to 2026-09-02

## 1. Gemini API key swap

- `mobile/.env.local`'s `EXPO_PUBLIC_GOOGLE_GEMINI_API_KEY` was on a key with no funded prepay balance, so every real-model call failed with "prepayment credits are depleted" and the app silently fell back to mock valuations.
- Swapped in a paid-account key (previously used by the Google Apps Script lead-capture flow, `AIzaSyA82o...`) — verified live against `generativelanguage.googleapis.com` before swapping.
- `backend/.env.local`'s Gemini key was left as-is; that route isn't called by the mobile app yet.

## 2. Full narrative report + auto-email

The old Apps Script flow (Google Form → Gemini → branded PDF → auto-email) was a separate, older system, not part of the iOS app. Brought the same capability into the app itself:

- **`mobile/services/report.service.ts`** — the Gemini prompt now asks for the same 10-section narrative report (Executive Summary → Disclaimer) the Apps Script used, split from the structured JSON via a literal `===FULL_REPORT===` marker (avoids asking the model to JSON-escape a multi-paragraph report as a string).
- **`backend/src/services/pdf.ts`** — renders that markdown (headers, bullets, bold spans, tables) into the PDF via a new `renderNarrativeReport` function.
- **`backend/src/routes/reports.ts`** — new `POST /:reportId/deliver` endpoint: generates the PDF and emails it as an attachment.
- **`mobile/app/consumer/loading.tsx`** — fires that endpoint (non-blocking, fire-and-forget) right after a report is created.
- **Bug fixed along the way:** `backend/src/services/supabase.ts`'s `getReport()` joined a nonexistent `comparable_sales` table and read property facts (address, bedrooms, etc.) from the wrong row. This path had never actually been exercised before.
- **Still blocked:** `backend/.env.local`'s `POSTMARK_API_KEY` is a placeholder, so the email step fails silently (by design — it's fire-and-forget). Needs a real key from postmarkapp.com before emails actually send.

## 3. Currency bug: PH homes were valued in USD, not PHP

Caught by asking "are homes in the Philippines really worth millions in dollars, or in Peso?" — a real bug, not a display quirk. Every property-value display and the Gemini prompt itself hardcoded `currency: 'USD'` regardless of the property's country. The original "pricing stays USD everywhere" decision was about *broker subscription* pricing (the $499 Founder Lifetime tier, Stripe) only, and had been mistakenly applied to property valuations too.

**Fix:**
- `mobile/config/marketConfig.ts` — added a `currency` (ISO 4217) field to each per-country market entry, plus a `formatCurrency(amountMinorUnits, countryCode)` export.
- `backend/src/utils/formatCurrency.ts` — mirrors the same map for the backend (separate package, no shared module).
- The Gemini prompt (`buildValuationPrompt`) now explicitly tells the model which local currency to reason in and shows comparables already formatted in that currency, instead of implicitly biasing it toward USD via a hardcoded `$`.
- `country_code` is now stashed into `gemini_response` at generation time so any screen with only the `reports` row (no property join) can still pick the right currency.
- Updated every display site: `report-view.tsx`, `account.tsx`, `broker/lead-detail.tsx`, `broker/lead-inbox.tsx`, `broker/dashboard.tsx`, plus the backend PDF/email formatters.
- **Left alone (deliberately):** broker subscription pricing stays USD-only everywhere — that was always a separate, intentional business decision.
- **Known remaining gap:** `broker/dashboard.tsx`'s `averageLeadValue` metric is still hardcoded mock data — meaningless either way today, but will need a real design decision (which currency for a cross-market aggregate?) once wired to real numbers.

## 4. PDF font bug: peso sign rendered as "±"

PDFKit's built-in fonts (Helvetica etc.) only support the WinAnsi/CP1252 character set, which has no ₱ (Philippine Peso, U+20B1) — it silently substituted a fallback glyph.

**Fix:** embedded Noto Sans (OFL license) into the PDF generator.
- `backend/src/assets/fonts/NotoSans-Variable.ttf` + `OFL.txt` (fetched from the `google/fonts` GitHub repo).
- `backend/src/services/pdf.ts` — exported `registerFonts(doc)`, registers the font, and every `'Helvetica'`/`'Helvetica-Bold'` call was switched to `'NotoSans'`.
- **Trade-off:** it's a variable font; PDFKit's public API has no way to select a named bold instance from it (confirmed by hitting an internal `fontkit`/`pdfkit` error trying to extract one directly). Headers now rely on size/color for hierarchy instead of true bold weight.
- **Known follow-up, not yet fixed:** embedding this font causes "fi"/"fl" letter sequences (financial, floor, deficiencies, confidence...) to lose a letter when the PDF's text is copy-pasted or read by accessibility tools (e.g. "fnancial"). Confirmed this is a text-layer/ToUnicode-CMap issue only — the rendered page displays correctly on screen. Disabling ligature features via PDFKit's `features` option did not fix it; the cause is lower-level (likely PDFKit's automatic font subsetting not handling multi-codepoint ligature glyphs correctly, and PDFKit exposes no way to disable subsetting). Real impact is limited to copy-paste, search-indexing, and screen readers — worth revisiting if accessibility compliance matters.

## 5. Address precision: subdivision-level addresses treated as one property

Caught via a real example: "JCMC Ville Subdivision, Brgy Bancal, Guagua Pampanga" is an entire subdivision, not one house, but the app generated a confident-looking valuation for it as if it were a single property.

The detection logic already existed (`mobile/utils/addressComponents.ts`'s `isPreciseAddress()` — checks for a street number, named building, or unit) and already showed a warning banner ("⚠️ No specific property number") — but it was purely cosmetic. The **Continue** button didn't check it, so users could ignore the warning and proceed anyway.

**Fix:** `mobile/app/consumer/address-entry.tsx`'s `handleContinue` now shows a confirmation dialog when the address is imprecise:

> **No Specific Property Number**
> This looks like a street, subdivision, or area rather than one property. A valuation generated for an entire area instead of a single home will not be accurate. Continue anyway?
> [Go Back] [Continue Anyway]

A precise address (street number, named building, or unit) skips this entirely. Reuses the same `Alert.alert` confirm/cancel pattern already used elsewhere in the app (e.g. `loading.tsx`'s monthly-limit alert).

**Not yet verified live** — this needs either a physical device via Expo Go (blocked by the public Wi-Fi firewall situation at time of writing) or a fresh test account on the web preview, since prior test accounts were wiped.

## Sample reports generated during this work

For reference, sample PDFs were generated (via a standalone script exercising the real Gemini + PDF pipeline, not through the app UI) for:
- Cebu City, PH condo
- BF Homes, Parañaque house
- Two Serendra, BGC condo
- JCMC Ville Subdivision, Guagua, Pampanga (flagged as imprecise — the trigger for fix #5 above)
- 4/22 Tableland Road, Tarneit VIC (AU)
- Lot 1 - 37/850 Bridge Inn Road, Doreen, VIC (AU)

These were demonstration/test artifacts, not real listings — property specifics (bedrooms, size, comparables) were reasonable assumptions, not verified data.
