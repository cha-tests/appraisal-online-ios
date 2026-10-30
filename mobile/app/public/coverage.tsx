import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, SectionList, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaWrapper } from '../../components/layout/SafeAreaWrapper';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { TextInput } from '../../components/ui/TextInput';
import { brokerService } from '../../services/broker.service';
import { ALL_COUNTRIES, countryFlagEmoji } from '../../config/countries';
import { City } from '../../types';
import { theme } from '../../theme';

const COUNTRY_NAMES: Record<string, string> = Object.fromEntries(
  ALL_COUNTRIES.map((c) => [c.code, c.name])
);

interface CitySection {
  title: string;
  data: City[];
}

/**
 * "Is my city covered?" — the single most-repeated trust objection across
 * the synthetic user research (consumers and brokers alike, outside Metro
 * Manila/major cities, unsure whether the product even applies to them).
 * Answers it honestly rather than just listing seeded cities: the AI
 * valuation itself works for any address in a launched market (US, PH) —
 * `cities` only gates whether a local professional is already signed up to
 * follow up, which is a narrower claim than "do you support my area."
 */
export default function CoveragePage() {
  const router = useRouter();
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const { success, cities: fetchedCities } = await brokerService.getCities();
        if (success && fetchedCities) setCities(fetchedCities);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const sections = useMemo<CitySection[]>(() => {
    const query = searchQuery.trim().toLowerCase();
    const matches = (c: City) =>
      !query || c.name.toLowerCase().includes(query) || !!c.state?.toLowerCase().includes(query);

    const byCountry = new Map<string, City[]>();
    cities.filter(matches).forEach((city) => {
      const list = byCountry.get(city.country) ?? [];
      list.push(city);
      byCountry.set(city.country, list);
    });

    return Array.from(byCountry.entries())
      .sort(([a], [b]) => (COUNTRY_NAMES[a] ?? a).localeCompare(COUNTRY_NAMES[b] ?? b))
      .map(([code, list]) => ({
        title: `${countryFlagEmoji(code)} ${COUNTRY_NAMES[code] ?? code}`,
        data: list,
      }));
  }, [cities, searchQuery]);

  const totalMatches = sections.reduce((sum, s) => sum + s.data.length, 0);

  return (
    <SafeAreaWrapper scrollable onBackPress={() => router.back()}>
      <View style={styles.header}>
        <Text style={styles.title}>Is Your City Covered?</Text>
        <Text style={styles.subtitle}>
          Your free AI valuation works for any address in the US or the Philippines — it isn't
          limited to the cities below. This list shows where local real estate professionals are
          already signed up to follow up after your report.
        </Text>
      </View>

      <TextInput
        placeholder="Search your city or province..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        autoCapitalize="none"
      />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.color.accent} />
          <Text style={styles.loadingText}>Loading coverage...</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          style={styles.list}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{section.title}</Text>
          )}
          renderItem={({ item }) => (
            <View style={styles.cityRow}>
              <Text style={styles.cityName}>{item.name}</Text>
              {!!item.state && <Text style={styles.cityState}>{item.state}</Text>}
            </View>
          )}
          ListEmptyComponent={
            <Card variant="default" style={styles.emptyState}>
              <Text style={styles.emptyStateTitle}>No professionals listed there yet</Text>
              <Text style={styles.emptyStateText}>
                Your valuation will still work — we just don't have a local professional signed up
                in that area yet. As we grow, coverage expands city by city.
              </Text>
            </Card>
          }
        />
      )}

      {!loading && totalMatches > 0 && (
        <Text style={styles.countNote}>
          {totalMatches} {totalMatches === 1 ? 'city' : 'cities'} with professionals ready to follow
          up
        </Text>
      )}

      <View style={styles.footer}>
        <Button
          title="Get My Free Valuation"
          size="large"
          onPress={() => router.push('/welcome')}
          style={{ marginBottom: 12 }}
        />
        <Button
          title="Become a Founding Professional"
          variant="outline"
          size="large"
          onPress={() => router.push('/public/founders')}
        />
      </View>
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.color.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: theme.color.textMuted,
    lineHeight: 20,
  },
  loadingContainer: {
    paddingVertical: 64,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: theme.color.textMuted,
  },
  list: {
    marginTop: 16,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.color.textMuted,
    backgroundColor: theme.color.bg,
    paddingTop: 16,
    paddingBottom: 6,
  },
  cityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  cityName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.color.text,
  },
  cityState: {
    fontSize: 13,
    color: theme.color.textFaint,
  },
  countNote: {
    fontSize: 12,
    color: theme.color.textFaint,
    textAlign: 'center',
    marginTop: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: theme.color.surface,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.color.text,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: theme.color.textMuted,
    lineHeight: 20,
    textAlign: 'center',
  },
  footer: {
    marginTop: 24,
    marginBottom: 32,
  },
});
