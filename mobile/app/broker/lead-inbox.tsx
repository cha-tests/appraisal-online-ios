import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  SectionList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaWrapper } from '../../components/layout/SafeAreaWrapper';
import { TextInput } from '../../components/ui/TextInput';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useAuthStore } from '../../stores/auth.store';
import { supabase } from '../../services/supabase';
import { Lead } from '../../types';

interface LeadWithRouting extends Lead {
  delivery_status?: string;
  delivery_channel?: string;
  delivery_timestamp?: string;
}

export default function LeadInbox() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [leads, setLeads] = useState<LeadWithRouting[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<LeadWithRouting[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'new' | 'contacted' | 'converted'>('all');

  useEffect(() => {
    const loadLeads = async () => {
      try {
        if (!user?.id) return;

        setLoading(true);

        // Fetch leads routed to this broker
        const { data: leadRoutings } = await supabase
          .from('lead_routings')
          .select('*, lead:lead_id(*)')
          .eq('broker_id', user.id)
          .order('created_at', { ascending: false });

        if (leadRoutings) {
          const enrichedLeads = leadRoutings.map((routing: any) => ({
            ...routing.lead,
            delivery_status: routing.delivery_status,
            delivery_channel: routing.delivery_channel,
            delivery_timestamp: routing.created_at,
          }));

          setLeads(enrichedLeads);
          setFilteredLeads(enrichedLeads);
        }
      } catch (err) {
        console.error('Error loading leads:', err);
      } finally {
        setLoading(false);
      }
    };

    loadLeads();

    // Subscribe to real-time updates
    const leadsSubscription = supabase
      .channel(`broker_inbox_${user?.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lead_routings',
          filter: `broker_id=eq.${user?.id}`,
        },
        () => {
          loadLeads();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(leadsSubscription);
    };
  }, [user?.id]);

  // Filter and search leads
  useEffect(() => {
    let filtered = leads;

    // Filter by status
    if (filterStatus !== 'all') {
      filtered = filtered.filter((lead) => lead.status === filterStatus);
    }

    // Search by address or email
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (lead) =>
          lead.property_address.toLowerCase().includes(query) ||
          lead.consumer_email.toLowerCase().includes(query)
      );
    }

    setFilteredLeads(filtered);
  }, [searchQuery, filterStatus, leads]);

  // Group leads by status
  const groupedLeads = {
    new: filteredLeads.filter((l) => l.status === 'new'),
    contacted: filteredLeads.filter((l) => l.status === 'contacted'),
    converted: filteredLeads.filter((l) => l.status === 'converted'),
  };

  const sections = [
    { title: `New (${groupedLeads.new.length})`, data: groupedLeads.new, status: 'new' },
    { title: `Contacted (${groupedLeads.contacted.length})`, data: groupedLeads.contacted, status: 'contacted' },
    { title: `Converted (${groupedLeads.converted.length})`, data: groupedLeads.converted, status: 'converted' },
  ].filter((s) => s.data.length > 0 || filterStatus === 'all');

  const renderLeadItem = ({ item }: { item: LeadWithRouting }) => (
    <TouchableOpacity
      style={styles.leadItem}
      onPress={() => router.push(`/broker/lead-detail?id=${item.id}`)}
      activeOpacity={0.7}
    >
      <View style={styles.leadItemHeader}>
        <View>
          <Text style={styles.leadItemAddress}>{item.property_address}</Text>
          <Text style={styles.leadItemEmail}>{item.consumer_email}</Text>
        </View>
        <View style={styles.leadItemRight}>
          <Text style={styles.leadItemValue}>
            ${(item.property_value ? item.property_value / 100 : 0).toLocaleString()}
          </Text>
          <View
            style={[
              styles.statusBadge,
              item.status === 'new' && styles.statusNew,
              item.status === 'contacted' && styles.statusContacted,
              item.status === 'converted' && styles.statusConverted,
            ]}
          >
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
        </View>
      </View>
      <View style={styles.leadItemFooter}>
        <Text style={styles.leadItemChannel}>via {item.delivery_channel || 'email'}</Text>
        <Text style={styles.leadItemDate}>
          {new Date(item.delivery_timestamp || item.created_at).toLocaleDateString()}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderSectionHeader = ({ section }: any) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
    </View>
  );

  return (
    <SafeAreaWrapper>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Your Leads</Text>
        <Text style={styles.headerSubtitle}>
          {filteredLeads.length} lead{filteredLeads.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Search & Filter */}
      <TextInput
        placeholder="Search by address or email..."
        value={searchQuery}
        onChangeText={setSearchQuery}
      />

      {/* Filter Buttons */}
      <View style={styles.filterButtons}>
        {(['all', 'new', 'contacted', 'converted'] as const).map((status) => (
          <TouchableOpacity
            key={status}
            style={[
              styles.filterButton,
              filterStatus === status && styles.filterButtonActive,
            ]}
            onPress={() => setFilterStatus(status)}
          >
            <Text
              style={[
                styles.filterButtonText,
                filterStatus === status && styles.filterButtonTextActive,
              ]}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Leads List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Loading leads...</Text>
        </View>
      ) : filteredLeads.length > 0 ? (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderLeadItem}
          renderSectionHeader={renderSectionHeader}
          scrollEnabled={true}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateIcon}>📭</Text>
          <Text style={styles.emptyStateTitle}>
            {searchQuery ? 'No leads found' : 'No leads yet'}
          </Text>
          <Text style={styles.emptyStateText}>
            {searchQuery
              ? 'Try adjusting your search'
              : 'Leads from consumers in your cities will appear here'}
          </Text>
        </View>
      )}
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  filterButtonActive: {
    borderColor: '#2563EB',
    backgroundColor: '#DBEAFE',
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  filterButtonTextActive: {
    color: '#2563EB',
  },
  listContent: {
    paddingBottom: 32,
  },
  sectionHeader: {
    marginTop: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  leadItem: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  leadItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  leadItemAddress: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
    maxWidth: '70%',
  },
  leadItemEmail: {
    fontSize: 13,
    color: '#6B7280',
  },
  leadItemRight: {
    alignItems: 'flex-end',
  },
  leadItemValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10B981',
    marginBottom: 6,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusNew: {
    backgroundColor: '#FEE2E2',
  },
  statusContacted: {
    backgroundColor: '#FEF3C7',
  },
  statusConverted: {
    backgroundColor: '#ECFDF5',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  leadItemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  leadItemChannel: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  leadItemDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyStateIcon: {
    fontSize: 56,
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
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: '80%',
  },
});
