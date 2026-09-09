import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaWrapper } from '../components/layout/SafeAreaWrapper';
import { AppMark } from '../components/ui/AppMark';
import { Button } from '../components/ui/Button';
import { setChosenRole } from '../utils/chosenRole';
import { theme } from '../theme';

/**
 * Choose role — the first interactive screen, reached from Launch by a
 * signed-out visitor with no path picked yet on this device (see
 * utils/chosenRole.ts). Both cards go straight to signup with the role
 * already chosen (see auth/signup.tsx's userType param) — neither a
 * homeowner nor a broker has an account yet, and Home/the dashboard both
 * require one.
 */
export default function Welcome() {
  const router = useRouter();

  const choose = async (role: 'consumer' | 'broker') => {
    await setChosenRole(role);
    router.replace(`/auth/signup?userType=${role}`);
  };

  return (
    <SafeAreaWrapper scrollable contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <AppMark size={44} />
        <Text style={styles.title}>Appraisal Online</Text>
        <Text style={styles.hero}>Know what your property is really worth</Text>
        <Text style={styles.subtitle}>
          Get an instant, AI-powered valuation backed by real comparable sales — free, in
          under 60 seconds, no obligation.
        </Text>
      </View>

      <View style={styles.cards}>
        <TouchableOpacity style={styles.card} onPress={() => choose('consumer')} activeOpacity={0.7}>
          <Text style={styles.cardTitle}>I own a property</Text>
          <Text style={styles.cardBody}>Get free AI valuations and connect with professionals</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.card} onPress={() => choose('broker')} activeOpacity={0.7}>
          <Text style={styles.cardTitle}>I'm a broker or agent</Text>
          <Text style={styles.cardBody}>Get qualified leads and grow your business</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.signinLine}>
        Already have an account?{' '}
        <Text style={styles.signinLink} onPress={() => router.push('/auth/login')}>
          Sign in
        </Text>
      </Text>

      {/* Learn more — the only in-app entry point into these three marketing
          screens; nothing else links to them. */}
      <View style={styles.learnMoreRow}>
        <Button
          title="Demo"
          variant="outline"
          size="small"
          onPress={() => router.push('/public/demo')}
          style={styles.learnMoreButton}
        />
        <Button
          title="How it works"
          variant="outline"
          size="small"
          onPress={() => router.push('/public/how-it-works')}
          style={styles.learnMoreButton}
        />
        <Button
          title="How we make money"
          variant="outline"
          size="small"
          onPress={() => router.push('/public/how-we-make-money')}
          style={styles.learnMoreButton}
        />
      </View>
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.space['3xl'],
  },
  title: {
    ...theme.type.subheading,
    color: theme.color.textMuted,
    marginTop: theme.space['2xl'] + 2,
    marginBottom: theme.space.sm,
  },
  hero: {
    ...theme.type.heading,
    color: theme.color.text,
    textAlign: 'center',
    marginBottom: theme.space.sm,
  },
  subtitle: {
    ...theme.type.bodySm,
    color: theme.color.textMuted,
    textAlign: 'center',
  },
  cards: {
    gap: theme.space.md,
  },
  card: {
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.lg,
    padding: theme.space.xl,
  },
  cardTitle: {
    ...theme.type.subheading,
    color: theme.color.text,
    marginBottom: theme.space.xs + 2,
  },
  cardBody: {
    ...theme.type.bodySm,
    color: theme.color.textMuted,
  },
  signinLine: {
    ...theme.type.bodySm,
    color: theme.color.text,
    textAlign: 'center',
    marginTop: theme.space['3xl'],
  },
  learnMoreRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: theme.space.sm,
    marginTop: theme.space['2xl'],
  },
  learnMoreButton: {
    flexGrow: 0,
  },
  signinLink: {
    textDecorationLine: 'underline',
    fontFamily: theme.font.bodySemibold,
  },
});
