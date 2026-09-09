import React, { useEffect, useRef } from 'react';
import { StyleSheet, Animated, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../stores/auth.store';
import { getChosenRole } from '../utils/chosenRole';
import { AppMark } from '../components/ui/AppMark';
import { theme } from '../theme';

/**
 * The Launch screen — the icon alone on white, per the design brief. This is
 * the bridge between the native splash (already held by _layout.tsx's
 * preventAutoHideAsync/hideAsync until fonts + auth resolve) and the first
 * real screen: fades the mark in, then hands off.
 *
 * A signed-in user skips the hold entirely — by the time this mounts,
 * _layout.tsx has already resolved auth state, so there is nothing left to
 * wait for and showing the full animation would just be a returning user
 * watching a delay they've seen before. A signed-out visitor gets the fade
 * and, unless they've already picked a path on this device (see
 * utils/chosenRole.ts), lands on Choose role instead of Home.
 *
 * The 1900ms timer and a tap both call the same handoff, guarded by a ref so
 * neither can fire it twice (e.g. a tap racing a timer that already fired).
 *
 * A signed-out visitor always needs an account before reaching Home or the
 * broker dashboard — neither screen has anything to show without one. A
 * chosen-but-unfinished role (see utils/chosenRole.ts) re-enters signup with
 * that role already selected rather than asking Choose role again.
 */
export default function Launch() {
  const router = useRouter();
  const navigated = useRef(false);

  const handoff = async () => {
    if (navigated.current) return;
    navigated.current = true;

    const { user, brokerProfile } = useAuthStore.getState();
    if (user) {
      // Matches auth/login.tsx's post-login routing — a returning user
      // never sees Choose role.
      router.replace(
        user.user_type === 'broker' ? (brokerProfile ? '/broker/dashboard' : '/broker/splash') : '/consumer/home'
      );
      return;
    }

    // No session — but a guest who already told this device which path
    // they're on shouldn't be asked again every relaunch.
    const chosen = await getChosenRole();
    if (chosen === 'consumer' || chosen === 'broker') {
      router.replace(`/auth/signup?userType=${chosen}`);
    } else {
      router.replace('/welcome');
    }
  };

  useEffect(() => {
    if (useAuthStore.getState().user) {
      // Returning user: skip the decorative wait, hand off immediately.
      handoff();
      return;
    }
    // No session: run the full 1900ms hold. A tap elsewhere cancels this by
    // setting navigated.current before the timer's own handoff() runs.
    const timer = setTimeout(handoff, 1900);
    return () => clearTimeout(timer);
    // Deliberately empty — must run exactly once on mount, same reasoning as
    // the previous index.tsx: reacting to later auth-state changes here
    // would risk a second, unwanted redirect after the user has moved on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.timing(opacity, {
      toValue: 1,
      duration: 500,
      delay: 120,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Pressable style={styles.container} onPress={handoff}>
      <Animated.View style={{ opacity }}>
        <AppMark size={104} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.color.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
