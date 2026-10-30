/**
 * Shared retry helpers. The realistic failure mode on a mobile connection is
 * transient (a dropped signal mid-request), not a bad request, so a couple of
 * retries with backoff resolves most of them without the person having to
 * notice or do anything.
 */

/** Retries any `{success}`-shaped async call unconditionally on failure. Used
 * for uploads, where any failure is worth a retry. */
export async function withRetry<T extends { success: boolean }>(
  fn: () => Promise<T>,
  maxRetries = 2,
  baseDelayMs = 800
): Promise<T> {
  let result: T;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    result = await fn();
    if (result.success || attempt === maxRetries) return result;
    await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** attempt));
  }
  return result!;
}

/** Retries only on a network/transport-level failure — a Supabase Auth error
 * always carries an error `code` (see auth-js's ErrorCode union); a raw fetch
 * exception (dropped signal, DNS hiccup) doesn't, which is what tells the two
 * apart here. A real failure like a wrong password or a taken email has a
 * code and returns immediately instead of wasting the person's time retrying
 * something retrying can't fix. */
export async function withNetworkRetry<T extends { success: boolean; error?: { code?: string } }>(
  fn: () => Promise<T>,
  maxRetries = 2,
  baseDelayMs = 800
): Promise<T> {
  let result: T;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    result = await fn();
    const isNetworkFailure = !result.success && !result.error?.code;
    if (result.success || !isNetworkFailure || attempt === maxRetries) return result;
    await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** attempt));
  }
  return result!;
}

/** A network/transport-level failure (see withNetworkRetry) shows a raw
 * exception message by default — "fetch failed: UnexpectedException: ..." —
 * which reads as a broken app rather than what it usually is, a momentary
 * connection drop. Swap in a plain-language message for that case only; a
 * real API error (wrong password, taken email) keeps its own message. */
export function friendlyAuthErrorMessage(
  error?: { message?: string; code?: string },
  fallback = 'Something went wrong. Please try again.'
): string {
  if (error && !error.code) {
    return "Couldn't connect. Please check your internet connection and try again.";
  }
  return error?.message || fallback;
}
