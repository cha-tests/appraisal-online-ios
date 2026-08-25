import { supabase, parseSupabaseError } from './supabase';
import { Report, Property, ComparableSale, ValueRange, ReportAllowance } from '../types';
import axios from 'axios';

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

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
    comparables: ComparableSale[]
  ): Promise<{
    success: boolean;
    estimatedValue?: number;
    confidenceRange?: ValueRange;
    geminiResponse?: Record<string, any>;
    error?: any;
  }> {
    try {
      // If no API key, use mock valuation based on comparables
      if (!GEMINI_API_KEY) {
        return this.generateMockValuation(propertyDetails, comparables);
      }

      const prompt = `
You are a real estate valuation expert. Based on the following property details and comparable sales, provide an AI-generated property valuation estimate.

PROPERTY DETAILS:
- Address: ${location}
- Bedrooms: ${propertyDetails.bedrooms}
- Bathrooms: ${propertyDetails.bathrooms}
- Square Feet: ${propertyDetails.square_feet}
- Year Built: ${propertyDetails.year_built}
- Property Type: ${propertyDetails.property_type}
- Condition: ${propertyDetails.condition}

COMPARABLE SALES (Recent):
${comparables.map((c) => `- ${c.address}: $${c.sale_price} (${c.sale_date}, ${c.distance_miles} mi away)`).join('\n')}

Provide your response as JSON with these fields:
{
  "estimated_value": <integer>,
  "confidence_low": <integer>,
  "confidence_high": <integer>,
  "confidence_percentage": <0-100>,
  "reasoning": "<brief explanation>",
  "market_trends": "<local market context>"
}

IMPORTANT: This is a computer estimate only. It is not a licensed appraisal. Banks, courts, and government agencies do not accept this as a formal valuation.
      `;

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
        }
      );

      const textContent = response.data.candidates[0].content.parts[0].text;
      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
      const valuationData = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

      if (!valuationData) {
        throw new Error('Failed to parse valuation response');
      }

      return {
        success: true,
        estimatedValue: valuationData.estimated_value,
        confidenceRange: {
          low: valuationData.confidence_low,
          high: valuationData.confidence_high,
        },
        geminiResponse: valuationData,
      };
    } catch (error) {
      console.error('Error generating valuation:', error);
      return {
        success: false,
        error: parseSupabaseError(error),
      };
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

  // Generate a mock valuation based on comparables (fallback when API key not set)
  generateMockValuation(
    propertyDetails: Record<string, any>,
    comparables: ComparableSale[]
  ): {
    success: boolean;
    estimatedValue: number;
    confidenceRange: ValueRange;
    geminiResponse: Record<string, any>;
  } {
    // Calculate average price from comparables
    const avgPrice =
      comparables.reduce((sum, c) => sum + c.sale_price, 0) / comparables.length;

    // Adjust based on property characteristics
    const sqftAdjustment =
      (propertyDetails.square_feet || 2000) / 2000; // Normalize to 2000 sqft
    const bedroomAdjustment = 1 + (propertyDetails.bedrooms || 3 - 3) * 0.1; // ±10% per bedroom
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

    return {
      success: true,
      estimatedValue,
      confidenceRange: {
        low: estimatedValue - range,
        high: estimatedValue + range,
      },
      geminiResponse: {
        estimated_value: estimatedValue,
        confidence_low: estimatedValue - range,
        confidence_high: estimatedValue + range,
        confidence_percentage: confidencePercent,
        reasoning: `Mock valuation based on ${comparables.length} comparable sales. Average sale price: $${Math.round(avgPrice).toLocaleString()}. Adjusted for property size (${propertyDetails.square_feet} sqft), bedrooms (${propertyDetails.bedrooms}), and condition (${propertyDetails.condition}).`,
        market_trends: 'Local market shows stable pricing with slight appreciation.',
        is_mock: true,
        note: 'This is a demonstration valuation. For real valuations, configure EXPO_PUBLIC_GEMINI_API_KEY.',
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

      const { error } = await supabase.from('leads').insert({
        report_id: reportId,
        property_id: propertyId,
        consumer_id: consumerId,
        consumer_email: user?.email || '',
        consumer_phone: report.phone_provided,
        property_address: property.address,
        property_value: report.estimated_value,
      });

      if (error) throw error;
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
