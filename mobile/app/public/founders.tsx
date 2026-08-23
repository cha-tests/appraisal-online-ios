import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaWrapper } from '../../components/layout/SafeAreaWrapper';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { TextInput } from '../../components/ui/TextInput';
import { brokerService } from '../../services/broker.service';

interface CityStatus {
  id: string;
  name: string;
  founderCount: number;
  capacity: number;
  available: boolean;
  percentageFilled: number;
}

export default function FoundersPage() {
  const router = useRouter();
  const [cities, setCities] = useState<CityStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredCities, setFilteredCities] = useState<CityStatus[]>([]);

  useEffect(() => {
    const loadCities = async () => {
      try {
        setLoading(true);
        const { success, cities: fetchedCities } = await brokerService.getCities();

        if (success && fetchedCities) {
          const citiesData = fetchedCities.map((city: any) => ({
            id: city.id,
            name: city.name,
            founderCount: city.founder_count_lifetime || 0,
            capacity: 30,
            available: (city.founder_count_lifetime || 0) < 30,
            percentageFilled: ((city.founder_count_lifetime || 0) / 30) * 100,
          }));

          // Sort by most available first
          citiesData.sort((a: any, b: any) => b.available - a.available || a.percentageFilled - b.percentageFilled);

          setCities(citiesData);
          setFilteredCities(citiesData);
        }
      } catch (err) {
        console.error('Error loading cities:', err);
      } finally {
        setLoading(false);
      }
    };

    loadCities();
  }, []);

  // Filter cities by search
  useEffect(() => {
    if (!searchQuery) {
      setFilteredCities(cities);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredCities(
        cities.filter((city) => city.name.toLowerCase().includes(query))
      );
    }
  }, [searchQuery, cities]);

  return (
    <SafeAreaWrapper scrollable>
      {/* Header */}
      <View style={styles.header}>
        <Button
          title="← Back"
          variant="outline"
          size="small"
          onPress={() => router.back()}
          style={{ alignSelf: 'flex-start', marginBottom: 16 }}
        />
        <Text style={styles.title}>Founder Membership Availability</Text>
        <Text style={styles.subtitle}>
          Limited to 30 qualified professionals per city
        </Text>
      </View>

      {/* Search */}
      <TextInput
        placeholder="Search cities..."
        value={searchQuery}
        onChangeText={setSearchQuery}
      />

      {/* Info Card */}
      <Card variant="outlined" style={styles.infoCard}>
        <Text style={styles.infoTitle}>🏆 Founder Lifetime Membership</Text>
        <Text style={styles.infoText}>
          $499 one-time investment. 14-day money-back guarantee. Includes 25 cities of coverage, real-time lead notifications, and lifetime access.
        </Text>
      </Card>

      {/* Cities List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Loading city availability...</Text>
        </View>
      ) : filteredCities.length > 0 ? (
        <FlatList
          data={filteredCities}
          renderItem={({ item }) => (
            <Card
              variant="default"
              style={[
                styles.cityCard,
                !item.available && styles.cityCardFull,
              ]}
            >
              <View style={styles.cityHeader}>
                <View>
                  <Text style={styles.cityName}>{item.name}</Text>
                  <Text style={styles.citySlots}>
                    {item.founderCount}/{item.capacity} members
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    item.available ? styles.statusOpen : styles.statusFull,
                  ]}
                >
                  <Text style={styles.statusText}>
                    {item.available ? 'Open' : 'Full'}
                  </Text>
                </View>
              </View>

              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(item.percentageFilled, 100)}%`,
                      backgroundColor: item.available ? '#10B981' : '#EF4444',
                    },
                  ]}
                />
              </View>

              <Text style={styles.availableSlots}>
                {item.available
                  ? `${item.capacity - item.founderCount} slots remaining`
                  : 'No slots available'}
              </Text>
            </Card>
          )}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          ListFooterComponent={
            <Card variant="outlined" style={styles.statsCard}>
              <Text style={styles.statsTitle}>Community Statistics</Text>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Total Cities</Text>
                <Text style={styles.statValue}>{cities.length}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Available Cities</Text>
                <Text style={styles.statValue}>
                  {cities.filter((c) => c.available).length}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Founder Members</Text>
                <Text style={styles.statValue}>
                  {cities.reduce((sum, c) => sum + c.founderCount, 0)}
                </Text>
              </View>
            </Card>
          }
        />
      ) : (
        <Card variant="default" style={styles.emptyState}>
          <Text style={styles.emptyStateIcon}>🔍</Text>
          <Text style={styles.emptyStateTitle}>No cities found</Text>
          <Text style={styles.emptyStateText}>
            Try adjusting your search
          </Text>
        </Card>
      )}

      {/* CTA */}
      <View style={styles.footer}>
        <Button
          title="Become a Founder Member"
          size="large"
          onPress={() => router.push('/broker/splash')}
          style={{ marginBottom: 12 }}
        />
        <Button
          title="Learn How It Works"
          variant="outline"
          size="large"
          onPress={() => router.push('/public/how-we-make-money')}
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
    color: '#1F2937',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  infoCard: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BFDBFE',
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  loadingContainer: {
    paddingVertical: 64,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  cityCard: {
    marginBottom: 12,
  },
  cityCardFull: {
    opacity: 0.7,
  },
  cityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cityName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 2,
  },
  citySlots: {
    fontSize: 13,
    color: '#6B7280',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  statusOpen: {
    backgroundColor: '#ECFDF5',
  },
  statusFull: {
    backgroundColor: '#FEE2E2',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1F2937',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  availableSlots: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  statsCard: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
    marginTop: 20,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  statItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  statLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2563EB',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 64,
    backgroundColor: '#F9FAFB',
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 6,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6B7280',
  },
  footer: {
    marginBottom: 32,
    marginTop: 20,
  },
});
