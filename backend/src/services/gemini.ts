import axios from 'axios';
import { logger } from '../utils/logger.js';
import { formatCurrency } from '../utils/formatCurrency.js';

// Use the "-latest" alias rather than a pinned version, matching
// mobile/services/report.service.ts — Google has already moved the
// recommended model forward once since this was first wired up, and an
// alias means the next generation shift doesn't require a code change.
const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent';

const MILES_TO_KM = 1.60934;
const KM_TO_MILES = 1 / MILES_TO_KM;

export interface ComparableSale {
  address: string;
  sale_price: number; // stored in cents, same convention as reports.estimated_value
  sale_date: string;
  distance_miles: number;
  similarity_score: number;
}

interface ValueRange {
  low: number;
  high: number;
}

interface ValuationResult {
  success: boolean;
  estimatedValue?: number;
  confidenceRange?: ValueRange;
  geminiResponse?: Record<string, any>;
  comparables?: ComparableSale[];
  error?: string;
}

// Mirrors mobile/config/marketConfig.ts's per-market table — backend and
// mobile are separate packages with no shared module today, so this is kept
// in sync by hand (same duplication utils/formatCurrency.ts and
// utils/formatDistance.ts already have).
const DISTANCE_UNIT: Record<string, 'mi' | 'km'> = {
  US: 'mi',
  PH: 'km',
  AU: 'km',
  GB: 'mi',
  SG: 'km',
  AE: 'km',
  CA: 'km',
  DE: 'km',
};

const CURRENCY: Record<string, string> = {
  US: 'USD',
  PH: 'PHP',
  AU: 'AUD',
  GB: 'GBP',
  SG: 'SGD',
  AE: 'AED',
  CA: 'CAD',
  DE: 'EUR',
};

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

// Literal marker the prompt instructs the model to emit between the JSON
// block and the narrative report — mirrors mobile/services/report.service.ts.
const REPORT_MARKER = '===FULL_REPORT===';

function buildValuationPrompt(
  propertyDetails: Record<string, any>,
  location: string,
  countryCode?: string | null
): string {
  const currency = (countryCode && CURRENCY[countryCode]) || 'USD';
  const distanceUnit = (countryCode && DISTANCE_UNIT[countryCode]) || 'km';
  const currencyName = CURRENCY_NAMES[currency] || currency;
  const distanceUnitName = distanceUnit === 'km' ? 'kilometers' : 'miles';
  const parkingLine =
    propertyDetails.parking_spaces !== undefined && propertyDetails.parking_spaces !== null
      ? `\n- Parking Spaces: ${propertyDetails.parking_spaces}`
      : '';

  return `You are a professional real estate analyst AI. Based on the following property details, produce (1) a structured valuation JSON block — including comparable sales you identify or plausibly estimate for this specific area, using your knowledge of the location — and (2) a full narrative valuation report.

PROPERTY DETAILS:
- Address: ${location}
- Bedrooms: ${propertyDetails.bedrooms}
- Bathrooms: ${propertyDetails.bathrooms}
- Square Feet: ${propertyDetails.square_feet}
- Year Built: ${propertyDetails.year_built}
- Property Type: ${propertyDetails.property_type}
- Condition: ${propertyDetails.condition}${parkingLine}

CONSISTENCY — READ THIS CAREFULLY: The PROPERTY DETAILS above are the actual, user-provided facts about this specific property. Every part of your response — the JSON block and every section of the narrative report, especially "Property Description" — MUST restate these exact same figures (bedrooms, bathrooms, square footage, year built, property type, condition, parking) with no substitutions, rounding, or invented alternatives. Do not describe a different, generic, or "typical" property for the area instead of the one actually described above — this is the single most common mistake to avoid. If the address itself is hard to place precisely (e.g. a Plus Code or an area with limited data), reason about the neighborhood/location using the address text, but the property's own physical facts always come from PROPERTY DETAILS above, never from assumptions about what's "typical" for that location.

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

function splitOnReportMarker(text: string): [string, string | null] {
  const markerIndex = text.indexOf(REPORT_MARKER);
  if (markerIndex === -1) {
    return [text, null];
  }
  return [text.slice(0, markerIndex), text.slice(markerIndex + REPORT_MARKER.length).trim()];
}

function parseGeneratedComparables(
  raw: unknown,
  countryCode?: string | null
): ComparableSale[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;

  const distanceUnit = (countryCode && DISTANCE_UNIT[countryCode]) || 'km';

  const parsed: ComparableSale[] = [];
  for (const entry of raw as any[]) {
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

function generateMockValuation(
  propertyDetails: Record<string, any>,
  comparables: ComparableSale[],
  countryCode?: string | null
): ValuationResult {
  const avgPrice =
    comparables.reduce((sum, c) => sum + c.sale_price / 100, 0) / comparables.length;

  const sqftAdjustment = (propertyDetails.square_feet || 2000) / 2000;
  const bedroomAdjustment = 1 + ((propertyDetails.bedrooms ?? 3) - 3) * 0.1;
  const conditionAdjustment =
    ({ Excellent: 1.15, Good: 1.0, Fair: 0.85, Poor: 0.7 } as Record<string, number>)[
      propertyDetails.condition
    ] || 1.0;

  const estimatedValue = Math.round(
    avgPrice * sqftAdjustment * bedroomAdjustment * conditionAdjustment
  );

  const confidencePercent = comparables.length >= 3 ? 85 : 70;
  const range = Math.round(estimatedValue * 0.1);

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
      note: 'This is a demonstration valuation. For real valuations, configure GEMINI_API_KEY on the backend.',
      country_code: countryCode || null,
      full_report_markdown: buildMockReportMarkdown(estimatedValue, comparables, propertyDetails, countryCode),
    },
  };
}

/**
 * Generates an AI property valuation via Gemini, run server-side so the API
 * key never ships to a client bundle — mirrors routes/places.ts's reasoning
 * for proxying Google Places, and now mirrors
 * mobile/services/report.service.ts's generateValuation logic exactly
 * (currency-aware prompt, model-generated comparables, narrative report),
 * which this file had fallen behind on before the web app started calling it.
 */
export async function generateValuation(
  propertyDetails: Record<string, any>,
  location: string,
  comparables: ComparableSale[],
  countryCode?: string | null
): Promise<ValuationResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return generateMockValuation(propertyDetails, comparables, countryCode);
  }

  try {
    const prompt = buildValuationPrompt(propertyDetails, location, countryCode);

    const response = await axios.post(`${GEMINI_API_URL}?key=${apiKey}`, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        // The 10-section narrative report runs long; the default max easily
        // truncates it mid-section, which then fails JSON/marker parsing.
        maxOutputTokens: 8192,
      },
    });

    const textContent = response.data.candidates[0].content.parts[0].text;
    const [jsonPart, reportPart] = splitOnReportMarker(textContent);
    const jsonMatch = jsonPart.match(/\{[\s\S]*\}/);
    const valuationData = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

    if (!valuationData) {
      throw new Error('Failed to parse valuation response');
    }

    valuationData.full_report_markdown = reportPart || null;
    valuationData.country_code = countryCode || null;

    const generatedComparables = parseGeneratedComparables(
      valuationData.comparable_sales,
      countryCode
    );

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
    // Fall back to mock rather than surfacing failure — a consumer asking
    // for a home valuation should get a usable number over a broken screen.
    // The mock result carries is_mock: true so it's never presented as real.
    logger.error('Gemini valuation failed, falling back to mock valuation:', error);
    return generateMockValuation(propertyDetails, comparables, countryCode);
  }
}
