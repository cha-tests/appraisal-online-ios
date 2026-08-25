import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../stores/auth.store';

type UserType = 'consumer' | 'broker';

interface RequireUserTypeProps {
  type: UserType;
  children: React.ReactNode;
}

const homeFor = (userType: UserType) =>
  userType === 'broker' ? '/broker/dashboard' : '/consumer/home';

/**
 * Route guard for a section of the app that belongs to one user type.
 *
 * Wrapping a layout's children means those screens never mount for the wrong
 * role. That matters beyond tidiness: the screens fetch on mount, so merely
 * redirecting while still rendering them would fire off requests for data the
 * signed-in user has no business loading.
 *
 * Deep links and typed URLs both go through the layout, so this covers them
 * as well as in-app navigation.
 *
 * This is a UX guard, not a security boundary — the real enforcement is
 * Supabase row-level security on the server. It stops the wrong screens from
 * being reachable; it does not by itself stop a crafted API call.
 */
export function RequireUserType({ type, children }: RequireUserTypeProps) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  const allowed = user?.user_type === type;

  useEffect(() => {
    // Redirect from an effect rather than during render — navigating mid-render
    // throws in expo-router.
    if (!user) {
      router.replace('/auth/login');
      return;
    }

    if (!allowed) {
      router.replace(homeFor(user.user_type as UserType));
    }
  }, [user, allowed, router]);

  if (!allowed) {
    // Render a placeholder, never `children`, so the guarded screens do not
    // mount (and do not fetch) while the redirect is in flight.
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
