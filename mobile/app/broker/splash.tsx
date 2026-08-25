import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaWrapper } from '../../components/layout/SafeAreaWrapper';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { brokerService } from '../../services/broker.service';
import { signOut } from '../../services/supabase';
import { useAuthStore } from '../../stores/auth.store';

interface CityCounter {
  city: string;
  founderCount: number;
  capacity: number;
  percentageFilled: number;
}

export default function BrokerSplash() {
  const router = useRouter();
  const [cities, setCities] = useState<CityCounter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchCities = async () => {
      try {
        setLoading(true);
        const { success, cities: fetchedCities } = await brokerService.getCities();

        if (success && fetchedCities) {
          // Show top 5 cities by founder count
          const citiesData = fetchedCities
            .map((city: any) => ({
              city: city.name,
              founderCount: city.founder_count_lifetime || 0,
              capacity: 30,
              percentageFilled: ((city.founder_count_lifetime || 0) / 30) * 100,
            }))
            .sort((a: any, b: any) => b.founderCount - a.founderCount)
            .slice(0, 5);

          setCities(citiesData);
        }
      } catch (err) {
        console.error('Error fetching cities:', err);
        setError('Unable to load city data');
      } finally {
        setLoading(false);
      }
    };

    fetchCities();
  }, []);

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
        <Text style={styles.heroIcon}>🎯</Text>
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

        <Card variant="default" style={styles.valueCard}>
          <View style={styles.valueItem}>
            <Text style={styles.valueIcon}>💰</Text>
            <Text style={styles.valueTitle}>Founder Option Available</Text>
            <Text style={styles.valueDescription}>
              One-time $499 lifetime membership with money-back guarantee
            </Text>
          </View>
        </Card>
      </View>

      {/* Founder Availability */}
      <View style={styles.founderSection}>
        <Text style={styles.sectionTitle}>Founder Membership Availability</Text>
        <Text style={styles.founderSubtitle}>
          Limited to 30 members per city. Check availability for your target cities.
        </Text>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color="#2563EB" />
          </View>
        ) : error ? (
          <Card variant="outlined" style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </Card>
        ) : (
          cities.map((city, index) => (
            <Card key={index} variant="default" style={styles.cityCard}>
              <View style={styles.cityHeader}>
                <Text style={styles.cityName}>{city.city}</Text>
                <Text style={[styles.cityCount, city.percentageFilled >= 100 && styles.cityCountFull]}>
                  {city.founderCount}/{city.capacity}
                </Text>
              </View>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(city.percentageFilled, 100)}%`,
                      backgroundColor: city.percentageFilled >= 100 ? '#EF4444' : '#10B981',
                    },
                  ]}
                />
              </View>
              <Text style={styles.cityStatus}>
                {city.percentageFilled >= 100
                  ? 'Founder slots full'
                  : `${30 - city.founderCount} slots available`}
              </Text>
            </Card>
          ))
        )}
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
  heroIcon: {
    fontSize: 56,
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 12,
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#6B7280',
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
    color: '#1F2937',
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
    color: '#1F2937',
    marginBottom: 4,
  },
  valueDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  founderSection: {
    marginBottom: 32,
  },
  founderSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  loadingContainer: {
    paddingVertical: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorCard: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
  },
  errorText: {
    color: '#991B1B',
    fontSize: 14,
  },
  cityCard: {
    marginBottom: 12,
  },
  cityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cityName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  cityCount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
  },
  cityCountFull: {
    color: '#EF4444',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  cityStatus: {
    fontSize: 12,
    color: '#9CA3AF',
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
    color: '#1F2937',
    marginBottom: 6,
  },
  ctaDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  footer: {
    marginBottom: 32,
  },
  footerNote: {
    textAlign: 'center',
    fontSize: 12,
    color: '#9CA3AF',
  },
});
