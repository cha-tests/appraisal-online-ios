import React from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaWrapper } from '../../components/layout/SafeAreaWrapper';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { signOut } from '../../services/supabase';
import { useAuthStore } from '../../stores/auth.store';
import { theme } from '../../theme';

export default function BrokerSplash() {
  const router = useRouter();

  const handleGetStarted = () => {
    router.push('/broker/onboarding');
  };

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          useAuthStore.getState().clear();
          router.replace('/auth/login');
        },
      },
    ]);
  };

  return (
    <SafeAreaWrapper scrollable>
      {/* Hero Section */}
      <View style={styles.hero}>
        <Image
          source={require('../../assets/images/splash-icon.png')}
          style={styles.heroLogo}
          resizeMode="contain"
        />
        <Text style={styles.heroTitle}>Grow Your Real Estate Business</Text>
        <Text style={styles.heroSubtitle}>
          Get pre-qualified property leads from consumers actively seeking professional guidance
        </Text>
      </View>

      {/* Value Proposition */}
      <View style={styles.valueSection}>
        <Text style={styles.sectionTitle}>Why Join Appraisal Online?</Text>

        <Card variant="default" style={styles.valueCard}>
          <View style={styles.valueItem}>
            <Text style={styles.valueIcon}>⚡</Text>
            <Text style={styles.valueTitle}>Real-Time Leads</Text>
            <Text style={styles.valueDescription}>
              Get instant notifications when consumers opt in to broker contact
            </Text>
          </View>
        </Card>

        <Card variant="default" style={styles.valueCard}>
          <View style={styles.valueItem}>
            <Text style={styles.valueIcon}>📍</Text>
            <Text style={styles.valueTitle}>Targeted by Location</Text>
            <Text style={styles.valueDescription}>
              Focus on your cities. We direct marketing budget to your coverage areas
            </Text>
          </View>
        </Card>

        <Card variant="default" style={styles.valueCard}>
          <View style={styles.valueItem}>
            <Text style={styles.valueIcon}>✅</Text>
            <Text style={styles.valueTitle}>Pre-Qualified</Text>
            <Text style={styles.valueDescription}>
              Every lead includes a property valuation and homeowner contact info
            </Text>
          </View>
        </Card>

      </View>

      {/* CTA Section */}
      <View style={styles.ctaSection}>
        <Text style={styles.ctaTitle}>Ready to Get Started?</Text>
        <Text style={styles.ctaDescription}>
          Answer a few questions about your business to see which membership tier is right for you.
        </Text>
      </View>

      {/* Call to Action Button */}
      <View style={styles.footer}>
        <Button
          title="Start Your Application"
          size="large"
          onPress={handleGetStarted}
          style={{ marginBottom: 12 }}
        />
        <Text style={styles.footerNote}>
          Takes about 5 minutes • No commitment until payment
        </Text>
        <Text style={styles.coverageLink} onPress={() => router.push('/public/coverage')}>
          Not sure your city is covered? Check here
        </Text>
        <Button
          title="Sign Out"
          variant="outline"
          size="small"
          onPress={handleSignOut}
          style={{ marginTop: 20 }}
        />
      </View>
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    marginBottom: 32,
    paddingVertical: 24,
  },
  heroLogo: {
    width: 64,
    height: 64,
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: theme.color.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  heroSubtitle: {
    fontSize: 16,
    color: theme.color.textMuted,
    textAlign: 'center',
    lineHeight: 24,
    marginHorizontal: 8,
  },
  valueSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.color.text,
    marginBottom: 16,
  },
  valueCard: {
    marginBottom: 12,
    paddingVertical: 16,
  },
  valueItem: {
    paddingHorizontal: 8,
  },
  valueIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  valueTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.color.text,
    marginBottom: 4,
  },
  valueDescription: {
    fontSize: 14,
    color: theme.color.textMuted,
    lineHeight: 20,
  },
  ctaSection: {
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  ctaTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.color.text,
    marginBottom: 6,
  },
  ctaDescription: {
    fontSize: 14,
    color: theme.color.textMuted,
    lineHeight: 20,
  },
  footer: {
    marginBottom: 32,
  },
  footerNote: {
    textAlign: 'center',
    fontSize: 12,
    color: theme.color.textFaint,
  },
  coverageLink: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    color: theme.color.accent,
    marginTop: 16,
    textDecorationLine: 'underline',
  },
});
