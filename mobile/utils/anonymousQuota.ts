import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * A guest (pre-signup) can now generate a real Gemini valuation before an
 * account exists — see the sign-up gate in auth/signup.tsx. Without some
 * per-device cap, the same phone could generate unlimited paid Gemini calls
 * without ever creating an account. This is a UX speed bump, not a security
 * boundary (an uninstall/reinstall or a second device resets it) — the real
 * limit for a signed-in consumer is reportService.checkReportAllowance,
 * enforced against their account in Supabase.
 */
const KEY = 'anonymous_valuation_count';
export const ANONYMOUS_VALUATION_LIMIT = 3;

export async function getAnonymousValuationCount(): Promise<number> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? parseInt(raw, 10) || 0 : 0;
}

export async function hasAnonymousValuationsLeft(): Promise<boolean> {
  return (await getAnonymousValuationCount()) < ANONYMOUS_VALUATION_LIMIT;
}

export async function incrementAnonymousValuationCount(): Promise<number> {
  const next = (await getAnonymousValuationCount()) + 1;
  await AsyncStorage.setItem(KEY, String(next));
  return next;
}
