/**
 * Guards against the "stale redirect effect" bug during sign-out: a
 * sign-out handler clears auth state and explicitly navigates (e.g. to
 * Welcome), but expo-router's `replace` doesn't unmount the previous screen
 * instantly — that screen's own reactive redirect effect (useRequireAccount,
 * RequireUserType) can still see the now-null user a moment later and fire
 * a second, competing redirect that wins the race.
 *
 * A plain in-memory flag rather than a focus-context hook (useIsFocused):
 * useIsFocused pulled in expo-router's own internal react-navigation copy,
 * which threw "Couldn't find a navigation object" when called from a
 * `_layout.tsx` group wrapper (RequireUserType sits above the Stack it
 * wraps, not inside a screen) — reproduced live, not a guess. This sidesteps
 * that entirely: no navigation context involved, so nothing to mismatch.
 */
let signingOut = false;

export function beginSignOut(): void {
  signingOut = true;
}

export function isSigningOut(): boolean {
  return signingOut;
}
