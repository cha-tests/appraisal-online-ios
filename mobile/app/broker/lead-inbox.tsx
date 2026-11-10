import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SectionList,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaWrapper } from '../../components/layout/SafeAreaWrapper';
import { TextInput } from '../../components/ui/TextInput';
import { useAuthStore } from '../../stores/auth.store';
import { supabase } from '../../services/supabase';
import { LeadRoutingPreview, LeadRoutingStatus } from '../../types';
import { formatCurrency } from '../../config/marketConfig';
import { leadTagBadgeLabel } from '../../config/leadTags';
import { LEAD_ROUTING_STATUS_LABELS as STATUS_LABELS } from '../../config/leadRoutingStatus';
import { BROKER_DISCLAIMER_TEXT } from '../../config/disclaimers';
import { theme } from '../../theme';

const showTitleBadgeInfo = () =>
  Alert.alert('About the title badge', BROKER_DISCLAIMER_TEXT);

type FilterStatus = 'all' | LeadRoutingStatus;

const FILTERS: FilterStatus[] = ['all', 'new', 'contacted', 'in_talks', 'converted', 'lost', 'revoked'];

/** Masked price range (low–high), formatted in the lead's own market
 * currency — the only money figure shown before a broker claims. */
function formatPriceRange(item: LeadRoutingPreview): string {
  if (item.estimated_value_low == null || item.estimated_value_high == null) return 'Price range unavailable';
  return `${formatCurrency(item.estimated_value_low, item.city_country)} – ${formatCurrency(item.estimated_value_high, item.city_country)}`;
}

/** Whether another broker already filled every slot this homeowner asked
 * for — true only once requested_broker_count is known and met, so a
 * report with no count set (shouldn't happen once opted in, but defensive)
 * never falsely reads as full. */
function isAlreadyFull(item: LeadRoutingPreview): boolean {
  return item.requested_broker_count != null && item.claimed_count >= item.requested_broker_count;
}

export default function LeadInbox() {
  const router = useRouter();
  const { status: initialStatus } = useLocalSearchParams<{ status?: string }>();
  const user = useAuthStore((state) => state.user);
  const [leads, setLeads] = useState<LeadRoutingPreview[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<LeadRoutingPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  // Lets the dashboard's pipeline widget deep-link straight into one status
  // (e.g. /broker/lead-inbox?status=in_talks) — falls back to 'all' for a
  // plain nav or an unrecognized value.
  const [filterStatus, setFilterStatus] = useState<FilterStatus>(
    FILTERS.includes(initialStatus as FilterStatus) ? (initialStatus as FilterStatus) : 'all'
  );

  useEffect(() => {
    const loadLeads = async () => {
      try {
        if (!user?.id) return;

        setLoading(true);

        // Single source of truth for the broker side (migrations 037/038)
        // — PII fields come back null/undefined for anything not yet
        // claimed, enforced by the function itself, not just hidden here.
        const { data, error } = await supabase.rpc('get_my_lead_routings');
        if (error) throw error;

        setLeads((data as LeadRoutingPreview[]) || []);
      } catch (err) {
        console.error('Error loading leads:', err);
      } finally {
        setLoading(false);
      }
    };

    loadLeads();

    // Subscribe to real-time updates. Random suffix — see dashboard.tsx's
    // identical subscription for why a fixed channel name can throw
    // "cannot add postgres_changes callbacks ... after subscribe()" on a
    // fast remount.
    const leadsSubscription = supabase
      .channel(`broker_inbox_${user?.id}_${Math.random().toString(36).slice(2)}`)
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

    if (filterStatus !== 'all') {
      filtered = filtered.filter((lead) => lead.status === filterStatus);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((lead) => {
        // A claimed row can be searched by its real address/email; an
        // unclaimed one only has the masked fields to search against.
        const haystack =
          lead.claim_status === 'claimed'
            ? `${lead.property_address} ${lead.consumer_email}`
            : `${lead.property_type || ''} ${lead.city_name || ''}`;
        return haystack.toLowerCase().includes(query);
      });
    }

    setFilteredLeads(filtered);
  }, [searchQuery, filterStatus, leads]);

  const groupedLeads = FILTERS.filter((f) => f !== 'all').reduce(
    (acc, status) => ({ ...acc, [status]: filteredLeads.filter((l) => l.status === status) }),
    {} as Record<LeadRoutingStatus, LeadRoutingPreview[]>
  );

  const sections = (Object.keys(groupedLeads) as LeadRoutingStatus[])
    .map((status) => ({
      title: `${STATUS_LABELS[status]} (${groupedLeads[status].length})`,
      data: groupedLeads[status],
      status,
    }))
    .filter((s) => s.data.length > 0 || filterStatus === 'all');

  const renderLeadItem = ({ item }: { item: LeadRoutingPreview }) => {
    const claimed = item.claim_status === 'claimed';
    const full = !claimed && isAlreadyFull(item);

    return (
      <TouchableOpacity
        style={[styles.leadItem, full && styles.leadItemMuted]}
        onPress={() => router.push(`/broker/lead-detail?id=${item.lead_routing_id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.leadItemHeader}>
          <View style={{ flex: 1 }}>
            {claimed ? (
              <>
                <Text style={styles.leadItemAddress}>{item.property_address}</Text>
                <Text style={styles.leadItemEmail}>{item.consumer_email}</Text>
              </>
            ) : (
              <>
                <Text style={styles.leadItemAddress}>
                  {item.property_type || 'Property'} in {item.city_name || 'your area'}
                  {item.city_state ? `, ${item.city_state}` : ''}
                </Text>
                <Text style={styles.leadItemEmail}>
                  {full ? 'Already connected with enough professionals' : 'Tap to view & claim'}
                </Text>
              </>
            )}
            {item.has_title_on_file ? (
              // A real tap target, not just the tiny visual chip — this is
              // nested inside the much larger tappable lead card (which
              // navigates to lead-detail), so a too-small hit area made it a
              // coin flip whether a tap near the badge opened the info popup
              // or navigated away instead.
              <TouchableOpacity
                style={styles.titleBadge}
                onPress={showTitleBadgeInfo}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.titleBadgeText}>✓ Title on file</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.titleBadgeMuted}>
                <Text style={styles.titleBadgeMutedText}>No title yet</Text>
              </View>
            )}
            {!!item.lead_tags?.length && (
              <View style={styles.nicheTagsRow}>
                {item.lead_tags.map((tag) => (
                  <View key={tag} style={styles.nicheTag}>
                    <Text style={styles.nicheTagText}>{leadTagBadgeLabel(tag)}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
          <View style={styles.leadItemRight}>
            <Text style={styles.leadItemValue}>
              {claimed
                ? formatCurrency(item.estimated_value || 0, item.city_country)
                : formatPriceRange(item)}
            </Text>
            <View
              style={[
                styles.statusBadge,
                item.status === 'new' && styles.statusNew,
                item.status === 'contacted' && styles.statusContacted,
                item.status === 'in_talks' && styles.statusInTalks,
                item.status === 'converted' && styles.statusConverted,
                item.status === 'lost' && styles.statusLost,
                item.status === 'revoked' && styles.statusRevoked,
              ]}
            >
              <Text style={styles.statusText}>{STATUS_LABELS[item.status]}</Text>
            </View>
          </View>
        </View>
        <View style={styles.leadItemFooter}>
          <Text style={styles.leadItemChannel}>
            {claimed ? `via ${item.delivery_channel}` : full ? 'No longer available' : 'Not yet claimed'}
          </Text>
          <Text style={styles.leadItemDate}>{new Date(item.invited_at).toLocaleDateString()}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSectionHeader = ({ section }: any) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
    </View>
  );

  return (
    <SafeAreaWrapper onBackPress={() => router.back()}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Your Leads</Text>
        {/* Hidden while loading — showing "0 leads" alongside the "Loading
            leads..." spinner below read as a contradictory final answer
            before the real count ever arrived. */}
        {!loading && (
          <Text style={styles.headerSubtitle}>
            {filteredLeads.length} lead{filteredLeads.length !== 1 ? 's' : ''}
          </Text>
        )}
      </View>

      {/* Search & Filter */}
      <TextInput
        placeholder="Search by address, email, or area..."
        value={searchQuery}
        onChangeText={setSearchQuery}
      />

      {/* Filter Buttons */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterButtons}
        contentContainerStyle={styles.filterButtonsContent}
      >
        {FILTERS.map((status) => (
          <TouchableOpacity
            key={status}
            style={[styles.filterButton, filterStatus === status && styles.filterButtonActive]}
            onPress={() => setFilterStatus(status)}
          >
            <Text
              style={[styles.filterButtonText, filterStatus === status && styles.filterButtonTextActive]}
            >
              {status === 'all' ? 'All' : STATUS_LABELS[status]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Leads List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.color.accent} />
          <Text style={styles.loadingText}>Loading leads...</Text>
        </View>
      ) : filteredLeads.length > 0 ? (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.lead_routing_id}
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
    color: theme.color.text,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: theme.color.textMuted,
  },
  filterButtons: {
    // flexGrow: 0 stops the ScrollView itself from stretching to fill the
    // parent's available vertical space (its default in this layout) —
    // without it, every child pill stretched to fill that inherited
    // height instead of sizing to its own text.
    flexGrow: 0,
    marginBottom: 16,
    marginHorizontal: -16,
  },
  filterButtonsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.surface,
  },
  filterButtonActive: {
    borderColor: theme.color.accent,
    backgroundColor: theme.color.accentWash,
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.color.textMuted,
  },
  filterButtonTextActive: {
    color: theme.color.accent,
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
    color: theme.color.text,
  },
  leadItem: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    backgroundColor: theme.color.surface,
  },
  leadItemMuted: {
    opacity: 0.6,
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
    color: theme.color.text,
    marginBottom: 4,
  },
  leadItemEmail: {
    fontSize: 13,
    color: theme.color.textMuted,
  },
  titleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#DCFCE7',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginTop: 6,
  },
  titleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
  },
  titleBadgeMuted: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.color.border,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginTop: 6,
  },
  titleBadgeMutedText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.color.textFaint,
  },
  nicheTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 6,
  },
  nicheTag: {
    backgroundColor: '#EDE9FE',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  nicheTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#5B21B6',
  },
  leadItemRight: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  leadItemValue: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.color.success,
    marginBottom: 6,
    textAlign: 'right',
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
  statusInTalks: {
    backgroundColor: '#DBEAFE',
  },
  statusConverted: {
    backgroundColor: theme.color.successWash,
  },
  statusLost: {
    backgroundColor: '#F3F4F6',
  },
  statusRevoked: {
    backgroundColor: '#FECACA',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
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
    color: theme.color.textFaint,
    fontWeight: '500',
  },
  leadItemDate: {
    fontSize: 12,
    color: theme.color.textFaint,
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
    color: theme.color.textMuted,
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
    color: theme.color.text,
    marginBottom: 6,
  },
  emptyStateText: {
    fontSize: 14,
    color: theme.color.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: '80%',
  },
});
