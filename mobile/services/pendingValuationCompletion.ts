import AsyncStorage from '@react-native-async-storage/async-storage';
import { Property, PropertyDetailsFormData } from '../types';
import { PendingValuation } from '../stores/report.store';
import { reportService } from './report.service';

/**
 * A guest's resolved address + answered questions + already-generated
 * Gemini valuation, captured just before the sign-up gate. Supabase's
 * properties/reports tables both have a NOT NULL user_id foreign key, so
 * none of this can be written until an account exists — see the gate in
 * auth/signup.tsx.
 */
export interface PendingValuationPayload {
  property: Property;
  details: PropertyDetailsFormData;
  valuation: PendingValuation;
}

/**
 * Writes the property + report rows for a valuation that was generated
 * before signup, reusing the cached Gemini response rather than calling it
 * again. Used both right after signup (when it returns a session
 * immediately) and, if email confirmation is required, once the user
 * actually signs in — see the stash helpers below and auth/login.tsx.
 */
export async function completePendingValuation(userId: string, payload: PendingValuationPayload) {
  const propertyResult = await reportService.createProperty(userId, payload.property.address, {
    address_components: payload.property.address_components,
    ...payload.details,
  });

  if (!propertyResult.success || !propertyResult.property) {
    return { success: false as const, error: 'Failed to create property record' };
  }

  const reportResult = await reportService.createReport(
    userId,
    propertyResult.property.id,
    payload.valuation.estimatedValue,
    payload.valuation.confidenceRange,
    payload.valuation.comparables,
    payload.valuation.geminiResponse
  );

  if (!reportResult.success || !reportResult.report) {
    return { success: false as const, error: 'Failed to create report' };
  }

  // Fire-and-forget, same as the signed-in path in loading.tsx.
  reportService.deliverReportEmail(reportResult.report.id);

  return { success: true as const, property: propertyResult.property, report: reportResult.report };
}

// ---------------------------------------------------------------- stash
//
// Only needed when signup doesn't return a session immediately (Supabase
// email confirmation is on) — Zustand state doesn't survive the app being
// closed while the user goes to check their inbox, so this is the fallback
// that lets auth/login.tsx finish the job on their first real sign-in.

const STASH_KEY = 'pending_valuation_v1';

export async function stashPendingValuation(payload: PendingValuationPayload): Promise<void> {
  await AsyncStorage.setItem(STASH_KEY, JSON.stringify(payload));
}

export async function readPendingValuationStash(): Promise<PendingValuationPayload | null> {
  const raw = await AsyncStorage.getItem(STASH_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingValuationPayload;
  } catch {
    return null;
  }
}

export async function clearPendingValuationStash(): Promise<void> {
  await AsyncStorage.removeItem(STASH_KEY);
}
