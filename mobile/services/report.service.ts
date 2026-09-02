import { supabase, parseSupabaseError } from './supabase';
import { Report, Property, ComparableSale, ValueRange, ReportAllowance } from '../types';
import axios from 'axios';
import { findCityId } from '../utils/matchCity';
import { brokerService } from './broker.service';
import { formatCurrency, getMarketConfig } from '../config/marketConfig';

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_GEMINI_API_KEY;
// Use the "-latest" alias rather than a pinned version. Verified live against
// a real key: gemini-2.5-flash now 404s for new API keys/projects ("no longer
// available to new users") — Google had already moved the recommended model
// forward once by the time this was first wired up. An alias means the next
// generation shift doesn't require another code change here.
const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent';

export const reportService = {
  // Check monthly allowance for free reports
  async checkReportAllowance(userId: string): Promise<{ allowed: boolean; remaining: number }> {
    try {
      const today = new Date();
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthDate = monthStart.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('report_allowance')
        .select('reports_used')
        .eq('user_id', userId)
        .eq('month', monthDate)
        .single();

      if (error && error.code === 'PGRST116') {
        // No record found, return full allowance
        return { allowed: true, remaining: 3 };
      }

      if (error) throw error;

      const used = data?.reports_used || 0;
      const remaining = Math.max(0, 3 - used);

      return {
        allowed: remaining > 0,
        remaining,
      };
    } catch (error) {
      console.error('Error checking report allowance:', error);
      return { allowed: false, remaining: 0 };
    }
  },

  // Create a property record
  async createProperty(userId: string, address: string, details: any) {
    try {
      const { data, error } = await supabase
        .from('properties')
        .insert({
          user_id: userId,
          address,
          ...details,
        })
        .select()
        .single();

      if (error) throw error;

      return { success: true, property: data as Property };
    } catch (error) {
      return {
        success: false,
        error: parseSupabaseError(error),
      };
    }
  },

  // Generate AI valuation using Gemini (or mock if key not set)
  async generateValuation(
    propertyDetails: Record<string, any>,
    location: string,
    comparables: ComparableSale[],
    countryCode?: string | null
  ): Promise<{
    success: boolean;
    estimatedValue?: number;
    confidenceRange?: ValueRange;
    geminiResponse?: Record<string, any>;
    comparables?: ComparableSale[];
    error?: any;
  }> {
    try {
      // If no API key, use mock valuation based on comparables
      if (!GEMINI_API_KEY) {
        return this.generateMockValuation(propertyDetails, comparables, countryCode);
      }

      const prompt = buildValuationPrompt(propertyDetails, location, countryCode);

      const response = await axios.post(
        `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
        {
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            // The 10-section narrative report runs long; the default max
            // easily truncates it mid-section, which then fails JSON/marker
            // parsing below.
            maxOutputTokens: 8192,
          },
        }
      );

      const textContent = response.data.candidates[0].content.parts[0].text;

      // The model is asked for two parts separated by a literal marker line
      // (see buildValuationPrompt) rather than one big JSON blob — asking it
      // to JSON-escape an entire multi-paragraph markdown report as a string
      // value is exactly the kind of thing models render just plausibly
      // enough to pass a glance and then break on real content (embedded
      // quotes, newlines). Splitting on the marker sidesteps that.
      const [jsonPart, reportPart] = splitOnReportMarker(textContent);
      const jsonMatch = jsonPart.match(/\{[\s\S]*\}/);
      const valuationData = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

      if (!valuationData) {
        throw new Error('Failed to parse valuation response');
      }

      valuationData.full_report_markdown = reportPart || null;
      // Stashed so any screen/PDF/email that only has the `reports` row (no
      // property join) can still pick the right currency to display in —
      // see marketConfig.ts's formatCurrency and its callers.
      valuationData.country_code = countryCode || null;

      // Gemini generates its own comparables now (see buildValuationPrompt —
      // it's asked for locally-plausible ones, since it has no real
      // MLS/transaction data to draw from). Falls back to the caller-supplied
      // placeholder comparables if the model's output is missing or
      // malformed, rather than failing the whole report over one bad field.
      const generatedComparables = parseGeneratedComparables(
        valuationData.comparable_sales,
        countryCode
      );

      // The prompt above asks Gemini for a plain integer in the property's
      // *local* currency (see buildValuationPrompt — it's told explicitly
      // which currency to use) — but every screen that renders
      // estimated_value/confidence_range divides by 100, on the assumption
      // that the stored value is the currency's minor unit (cents/centavos/
      // fils/...), the same convention subscriptions.price already uses for
      // USD. Converting here, once, at the boundary keeps that prompt
      // natural while still landing in the storage unit everything
      // downstream expects.
      return {
        success: true,
        estimatedValue: valuationData.estimated_value * 100,
        confidenceRange: {
          low: valuationData.confidence_low * 100,
          high: valuationData.confidence_high * 100,
        },
        geminiResponse: valuationData,
        comparables: generatedComparables || comparables,
      };
    } catch (error) {
      // Fall back to the mock valuation rather than surfacing failure to the
      // caller. Without this, any real-API problem — no prepay credit, a rate
      // limit, a model rename, a network blip — aborted report generation
      // entirely: loading.tsx treats `success: false` here as a hard failure
      // and throws, kicking the consumer back out mid-flow. A consumer asking
      // for a home valuation should get a usable number over a broken screen;
      // the mock result already carries `is_mock: true` in geminiResponse so
      // this is never presented as if it were a real AI valuation.
      console.error('Gemini valuation failed, falling back to mock valuation:', error);
      return this.generateMockValuation(propertyDetails, comparables, countryCode);
    }
  },

  // Create a report record
  async createReport(
    userId: string,
    propertyId: string,
    estimatedValue: number,
    confidenceRange: ValueRange,
    comparables: ComparableSale[],
    geminiResponse: Record<string, any>
  ) {
    try {
      const { data, error } = await supabase
        .from('reports')
        .insert({
          user_id: userId,
          property_id: propertyId,
          estimated_value: estimatedValue,
          confidence_range: confidenceRange,
          comparables,
          gemini_response: geminiResponse,
          status: 'generated',
        })
        .select()
        .single();

      if (error) throw error;

      // Increment report usage
      await this.incrementReportUsage(userId);

      return { success: true, report: data as Report };
    } catch (error) {
      return {
        success: false,
        error: parseSupabaseError(error),
      };
    }
  },

  // Ask the backend to generate the branded PDF and email it to the
  // consumer, mirroring the old Apps Script's auto-send-on-submit behavior.
  // Deliberately swallows its own errors — callers (loading.tsx) fire this
  // without awaiting so a slow or failing email (e.g. Postmark not
  // configured yet) never blocks or breaks the report-view navigation the
  // consumer is actually waiting on.
  async deliverReportEmail(reportId: string): Promise<void> {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) return;

      await axios.post(
        `${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001'}/api/reports/${reportId}/deliver`,
        {},
        { headers: { Authorization: `Bearer ${data.session.access_token}` } }
      );
    } catch (error) {
      console.error('Error emailing report (non-blocking):', error);
    }
  },

  // Generate a mock valuation based on comparables (fallback when API key not set)
  generateMockValuation(
    propertyDetails: Record<string, any>,
    comparables: ComparableSale[],
    countryCode?: string | null
  ): {
    success: boolean;
    estimatedValue: number;
    confidenceRange: ValueRange;
    geminiResponse: Record<string, any>;
  } {
    // comparables[].sale_price is stored in cents; this function's math (and
    // the "reasoning" text below, which quotes avgPrice directly) works in
    // plain dollars throughout, converting back to cents only in the
    // returned estimatedValue/confidenceRange — so the incoming cents value
    // is divided down once here, at the point it enters the calculation.
    const avgPrice =
      comparables.reduce((sum, c) => sum + c.sale_price / 100, 0) / comparables.length;

    // Adjust based on property characteristics
    const sqftAdjustment =
      (propertyDetails.square_feet || 2000) / 2000; // Normalize to 2000 sqft
    // ±10% per bedroom relative to a 3-bedroom baseline. The previous
    // `propertyDetails.bedrooms || 3 - 3` evaluated as `bedrooms || 0` (operator
    // precedence gives `3 - 3` first, then `||`), which doesn't compare to a
    // baseline at all — it scaled directly with bedroom count, so a 3-bedroom
    // property got a flat +30% rather than the intended +0%. Using `??`
    // instead of `||` for the missing-data fallback also matters here: a
    // studio (0 bedrooms) is a real, valid value, and `||` would have treated
    // it as "missing" and silently substituted 3.
    const bedroomAdjustment = 1 + ((propertyDetails.bedrooms ?? 3) - 3) * 0.1;
    const conditionAdjustment =
      {
        Excellent: 1.15,
        Good: 1.0,
        Fair: 0.85,
        Poor: 0.7,
      }[propertyDetails.condition] || 1.0;

    const estimatedValue = Math.round(
      avgPrice * sqftAdjustment * bedroomAdjustment * conditionAdjustment
    );

    // Confidence range: ±10% for good data, ±15% if few comparables
    const confidencePercent = comparables.length >= 3 ? 85 : 70;
    const range = Math.round(estimatedValue * 0.1);

    // estimatedValue/range above are plain dollars, matching the dollar-scale
    // comparables.sale_price they're derived from — natural for the math and
    // for the human-readable `reasoning` string below. But every screen that
    // renders report.estimated_value/confidence_range divides by 100 (the
    // same cents convention subscriptions.price already uses), so the
    // returned, stored values need the conversion applied here, once.
    return {
      success: true,
      estimatedValue: estimatedValue * 100,
      confidenceRange: {
        low: (estimatedValue - range) * 100,
        high: (estimatedValue + range) * 100,
      },
      geminiResponse: {
        estimated_value: estimatedValue,
        confidence_low: estimatedValue - range,
        confidence_high: estimatedValue + range,
        confidence_percentage: confidencePercent,
        reasoning: `Mock valuation based on ${comparables.length} comparable sales. Average sale price: ${formatCurrency(avgPrice * 100, countryCode)}. Adjusted for property size (${propertyDetails.square_feet} sqft), bedrooms (${propertyDetails.bedrooms}), and condition (${propertyDetails.condition}).`,
        market_trends: 'Local market shows stable pricing with slight appreciation.',
        is_mock: true,
        note: 'This is a demonstration valuation. For real valuations, configure EXPO_PUBLIC_GEMINI_API_KEY.',
        country_code: countryCode || null,
        // The PDF/email pipeline always reads gemini_response.full_report_markdown
        // (see pdf.ts's renderNarrativeReport) — this keeps that path working
        // even when Gemini is unavailable, instead of the PDF silently
        // dropping the entire narrative section for mock reports.
        full_report_markdown: buildMockReportMarkdown(estimatedValue, comparables, propertyDetails, countryCode),
      },
    };
  },

  // Increment report usage counter
  async incrementReportUsage(userId: string) {
    try {
      const today = new Date();
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthDate = monthStart.toISOString().split('T')[0];

      const { error } = await supabase.rpc('increment_report_usage', {
        user_id_param: userId,
        report_month: monthDate,
      });

      if (error) throw error;
    } catch (error) {
      console.error('Error incrementing report usage:', error);
    }
  },

  // Fetch a property by ID
  async getProperty(propertyId: string) {
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('id', propertyId)
        .single();

      if (error) throw error;

      return { success: true, property: data as Property };
    } catch (error) {
      return {
        success: false,
        error: parseSupabaseError(error),
      };
    }
  },

  // Fetch report by ID
  async getReport(reportId: string) {
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('id', reportId)
        .single();

      if (error) throw error;

      return { success: true, report: data as Report };
    } catch (error) {
      return {
        success: false,
        error: parseSupabaseError(error),
      };
    }
  },

  // Fetch all reports for a user
  async getUserReports(userId: string, limit = 20, offset = 0) {
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      return { success: true, reports: data as Report[] };
    } catch (error) {
      return {
        success: false,
        error: parseSupabaseError(error),
      };
    }
  },

  // Update broker contact opt-in
  async updateBrokerOptIn(reportId: string, optedIn: boolean, phone?: string) {
    try {
      const { data, error } = await supabase
        .from('reports')
        .update({
          broker_contact_opted_in: optedIn,
          phone_provided: phone || null,
        })
        .eq('id', reportId)
        .select()
        .single();

      if (error) throw error;

      // If opted in, create a lead
      if (optedIn && data.property_id) {
        await this.createLeadFromReport(reportId, data.user_id, data.property_id);
      }

      return { success: true, report: data as Report };
    } catch (error) {
      return {
        success: false,
        error: parseSupabaseError(error),
      };
    }
  },

  // Create a lead record when consumer opts in
  async createLeadFromReport(reportId: string, consumerId: string, propertyId: string) {
    try {
      // Fetch report and property for lead info
      const { data: report } = await supabase.from('reports').select('*').eq('id', reportId).single();
      const { data: property } = await supabase
        .from('properties')
        .select('*')
        .eq('id', propertyId)
        .single();

      if (!report || !property) return;

      const { data: user } = await supabase.from('users').select('email').eq('id', consumerId).single();

      // Resolve which seeded city this property falls in, so the lead can be
      // routed to brokers subscribed to that city below. Previously this was
      // never set, so every lead's city_id was null and no broker — no matter
      // which cities they'd selected — could ever match one.
      const cityId = await findCityId(
        property.address_components?.city,
        property.address_components?.country_code
      );

      const { data: lead, error } = await supabase
        .from('leads')
        .insert({
          report_id: reportId,
          property_id: propertyId,
          consumer_id: consumerId,
          consumer_email: user?.email || '',
          consumer_phone: report.phone_provided,
          property_address: property.address,
          property_value: report.estimated_value,
          city_id: cityId,
        })
        .select()
        .single();

      if (error) throw error;

      // Previously nothing ever inserted into lead_routings, so a lead existed
      // in the database but no broker's inbox ever showed it, regardless of
      // whether their selected_cities matched.
      const routeResult = await brokerService.routeLeadToBrokers(lead.id, cityId);
      if (!routeResult.success) {
        console.error('Lead created but routing failed:', routeResult.error);
      }
    } catch (error) {
      console.error('Error creating lead from report:', error);
    }
  },

  // Generate PDF URL (placeholder - integrate with PDF service)
  async generatePDF(reportId: string): Promise<{ success: boolean; url?: string; error?: any }> {
    try {
      // TODO: Implement PDF generation using a service like PDFKit or SendGrid
      // For now, return a placeholder
      const pdfUrl = `https://appraisal-online.s3.amazonaws.com/reports/${reportId}.pdf`;

      const { error } = await supabase
        .from('reports')
        .update({ pdf_url: pdfUrl })
        .eq('id', reportId);

      if (error) throw error;

      return { success: true, url: pdfUrl };
    } catch (error) {
      return {
        success: false,
        error: parseSupabaseError(error),
      };
    }
  },
};

// Literal marker the prompt instructs the model to emit between the JSON
// block and the narrative report. Kept as a constant so the prompt text and
// the parser can't drift out of sync.
const REPORT_MARKER = '===FULL_REPORT===';

// Names used only to spell the currency out unambiguously in the prompt
// text below — Gemini otherwise defaults to reasoning in USD regardless of
// the property's actual market, which is exactly the bug this fixes (a
// Philippine home was coming back valued at literal millions of US
// dollars). Intl.NumberFormat elsewhere just needs the ISO code, but a
// bare 3-letter code in prose is easy for a model to skim past.
const CURRENCY_NAMES: Record<string, string> = {
  USD: 'US Dollars',
  PHP: 'Philippine Pesos',
  AUD: 'Australian Dollars',
  GBP: 'British Pounds',
  SGD: 'Singapore Dollars',
  AED: 'UAE Dirhams',
  CAD: 'Canadian Dollars',
  EUR: 'Euros',
};

function buildValuationPrompt(
  propertyDetails: Record<string, any>,
  location: string,
  countryCode?: string | null
): string {
  const { currency, distanceUnit } = getMarketConfig(countryCode);
  const currencyName = CURRENCY_NAMES[currency] || currency;
  const distanceUnitName = distanceUnit === 'km' ? 'kilometers' : 'miles';

  return `You are a professional real estate analyst AI. Based on the following property details, produce (1) a structured valuation JSON block — including comparable sales you identify or plausibly estimate for this specific area, using your knowledge of the location — and (2) a full narrative valuation report.

PROPERTY DETAILS:
- Address: ${location}
- Bedrooms: ${propertyDetails.bedrooms}
- Bathrooms: ${propertyDetails.bathrooms}
- Square Feet: ${propertyDetails.square_feet}
- Year Built: ${propertyDetails.year_built}
- Property Type: ${propertyDetails.property_type}
- Condition: ${propertyDetails.condition}

COMPARABLE SALES: You do not have live MLS/transaction data, so you cannot cite verified real sales. Instead, generate exactly 3 plausible comparable sales for streets or areas actually near this address — use real, specific local street/neighborhood names for this location rather than generic placeholders (e.g. real streets in the same subdivision, suburb, or district), with sale prices realistic for that specific area, not just the country as a whole. These represent your best local-market estimate, not verified transactions — do not claim or imply they are confirmed real sales.

IMPORTANT — CURRENCY: This property is in a ${currencyName} (${currency}) market. Every monetary figure you produce — estimated_value, confidence_low, confidence_high, every comparable sale price, and every price mentioned anywhere in the narrative report — MUST be a realistic ${currency} amount for this specific location, not a US-dollar figure.

Respond in EXACTLY this format — the JSON object first, then the literal line "${REPORT_MARKER}", then the narrative report. Do not add anything before the JSON or after the marker besides what's specified.

{
  "estimated_value": <integer, in ${currency}>,
  "confidence_low": <integer, in ${currency}>,
  "confidence_high": <integer, in ${currency}>,
  "confidence_percentage": <0-100>,
  "reasoning": "<brief explanation>",
  "market_trends": "<local market context>",
  "comparable_sales": [
    {
      "address": "<a specific, real-sounding local street/area name near this property — not a generic placeholder>",
      "sale_price": <integer, in ${currency}>,
      "sale_date": "<YYYY-MM-DD, within the last 6 months>",
      "distance": <number, straight-line distance from the subject property in ${distanceUnitName.toUpperCase()} (this market's local unit), e.g. 0.5>,
      "similarity_score": <number between 0 and 1, e.g. 0.92>
    }
    // exactly 3 entries, ordered by distance ascending
  ]
}
${REPORT_MARKER}
## 1. Executive Summary
Brief overview of the property, its estimated value range, and the key factors influencing the valuation.

## 2. Property Description
Describe the property based on the provided details: type, size, rooms, age, notable features.

## 3. Location Analysis
Analyze the location based on the address. Discuss general market conditions, neighborhood characteristics, accessibility, and proximity to amenities.

## 4. Market Analysis
Overview of the current real estate market in the area: trends in property values, supply and demand dynamics, comparable sales context.

## 5. Valuation Methodology
Explain the approaches used: Sales Comparison Approach, Income Approach (if applicable), Cost Approach, and how each applies here.

## 6. Estimated Value Range
Low, mid, and high estimate for the property value, with the reasoning behind each.

## 7. Value Influencing Factors
Positive and negative factors affecting the property value: condition, location, market trends, renovations, risks.

## 8. Investment Potential
Rental yield estimates, appreciation potential, risks or opportunities.

## 9. Recommendations
Actionable recommendations tailored to a homeowner checking their property's value.

## 10. Disclaimer
Include this exact disclaimer: "This report is generated by an AI system and is intended for informational purposes only. It does not constitute a formal appraisal, professional valuation, or financial advice. The estimated values are based on publicly available data and AI analysis, and may not reflect actual market conditions. For legally binding valuations, please consult a licensed appraiser or real estate professional. Appraisal Online is operated by Digital Ventures, UAE."

FORMATTING RULES:
- Use markdown with ## for section headers
- Use bullet points for lists, **bold** for emphasis on key figures
- Use a markdown table for the estimated value range in section 6
- Keep language professional but accessible; provide specific numbers, not just qualitative descriptions
- Do NOT include images or links`;
}

/**
 * Splits the model's raw response into the leading JSON block and the
 * narrative report that follows REPORT_MARKER. Falls back to treating the
 * whole response as the JSON part (and no report) if the model didn't
 * follow the marker format — generateValuation's caller already falls back
 * to a mock valuation if JSON parsing then fails too.
 */
function splitOnReportMarker(text: string): [string, string | null] {
  const markerIndex = text.indexOf(REPORT_MARKER);
  if (markerIndex === -1) {
    return [text, null];
  }
  return [text.slice(0, markerIndex), text.slice(markerIndex + REPORT_MARKER.length).trim()];
}

const KM_TO_MILES = 1 / 1.60934;

/**
 * Validates and converts Gemini's self-generated `comparable_sales` into the
 * app's internal ComparableSale shape. Returns null on anything malformed
 * (wrong shape, non-array, empty) so the caller can fall back to the
 * placeholder comparables instead of storing garbage.
 *
 * Gemini is asked for `sale_price` in the property's local currency's major
 * unit and `distance` in the market's own local unit (km or mi — see
 * buildValuationPrompt) — both converted here to this app's internal storage
 * convention (minor units, always miles) at this one boundary, the same
 * "ask naturally, store canonically" approach used for currency/size
 * elsewhere in this file.
 */
function parseGeneratedComparables(
  raw: unknown,
  countryCode?: string | null
): ComparableSale[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;

  const { distanceUnit } = getMarketConfig(countryCode);

  const parsed: ComparableSale[] = [];
  for (const entry of raw) {
    if (
      !entry ||
      typeof entry.address !== 'string' ||
      typeof entry.sale_price !== 'number' ||
      typeof entry.sale_date !== 'string' ||
      typeof entry.distance !== 'number' ||
      typeof entry.similarity_score !== 'number'
    ) {
      return null;
    }

    parsed.push({
      address: entry.address,
      sale_price: Math.round(entry.sale_price * 100),
      sale_date: entry.sale_date,
      distance_miles: distanceUnit === 'km' ? entry.distance * KM_TO_MILES : entry.distance,
      similarity_score: entry.similarity_score,
    });
  }

  return parsed;
}

function buildMockReportMarkdown(
  estimatedValue: number,
  comparables: ComparableSale[],
  propertyDetails: Record<string, any>,
  countryCode?: string | null
): string {
  // estimatedValue arrives in the currency's major unit (matches
  // generateMockValuation's local variable before its *100 conversion),
  // so it's scaled back up here to match formatCurrency's minor-unit input.
  const formatted = formatCurrency(estimatedValue * 100, countryCode);
  return `## 1. Executive Summary
This is a **demonstration report** generated without a live AI valuation. The estimated value shown (${formatted}) is calculated directly from the comparable sales below, not from AI analysis.

## 2. Property Description
${propertyDetails.property_type || 'Property'} with ${propertyDetails.bedrooms ?? 'N/A'} bedrooms, ${propertyDetails.bathrooms ?? 'N/A'} bathrooms, approximately ${propertyDetails.square_feet ?? 'N/A'} sqft, built ${propertyDetails.year_built ?? 'N/A'}, in **${propertyDetails.condition || 'unspecified'}** condition.

## 3. Location Analysis
Not available in demonstration mode.

## 4. Market Analysis
Based on ${comparables.length} comparable sale(s) in the area.

## 5. Valuation Methodology
Sales Comparison Approach — average of comparable sale prices, adjusted for size, bedroom count, and condition.

## 6. Estimated Value Range
| Estimate | Value |
|---|---|
| Low | ${formatted} |
| Mid | ${formatted} |
| High | ${formatted} |

## 7. Value Influencing Factors
Not available in demonstration mode.

## 8. Investment Potential
Not available in demonstration mode.

## 9. Recommendations
Configure a live Gemini API key to receive full AI-generated analysis.

## 10. Disclaimer
This report is generated by an AI system and is intended for informational purposes only. It does not constitute a formal appraisal, professional valuation, or financial advice. The estimated values are based on publicly available data and AI analysis, and may not reflect actual market conditions. For legally binding valuations, please consult a licensed appraiser or real estate professional. Appraisal Online is operated by Digital Ventures, UAE.`;
}
