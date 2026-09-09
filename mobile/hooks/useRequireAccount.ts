import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../stores/auth.store';
import { isSigningOut } from '../utils/signOutGuard';

/**
 * For the handful of consumer screens that need a real, persisted account
 * (report-view, broker-optins, account) even though the group's layout now
 * lets a guest through for the pre-signup steps — see RequireUserType's
 * `allowGuest` and the sign-up gate in auth/signup.tsx. Sends a guest back
 * to Home rather than login, since Home is where they'd resume the flow.
 *
 * Guarded by isSigningOut() — see utils/signOutGuard.ts: a deliberate sign
 * out already navigates explicitly (to Welcome), and without this guard
 * this effect could still fire on the not-yet-unmounted account screen a
 * moment later and win the race, landing on Home instead.
 */
export function useRequireAccount() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    if (!user && !isSigningOut()) {
      router.replace('/consumer/home');
    }
  }, [user, router]);

  return user;
}
