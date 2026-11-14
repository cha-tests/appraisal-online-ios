import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Linking, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaWrapper } from '../../components/layout/SafeAreaWrapper';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { supabase } from '../../services/supabase';
import { LeadRoutingPreview } from '../../types';
import { formatCurrency } from '../../config/marketConfig';
import { leadTagBadgeLabel } from '../../config/leadTags';
import { LOST_REASON_OPTIONS } from '../../config/lostReasons';
import { LEAD_ROUTING_STATUS_LABELS as STATUS_LABELS } from '../../config/leadRoutingStatus';
import { BROKER_DISCLAIMER_TEXT } from '../../config/disclaimers';
import { theme } from '../../theme';

const yesNoLabel = (val: boolean | undefined) =>
  val === true ? 'Yes' : val === false ? 'No' : 'Not answered';

function isAlreadyFull(item: LeadRoutingPreview): boolean {
  return item.requested_broker_count != null && item.claimed_count >= item.requested_broker_count;
}

export default function LeadDetail() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const leadRoutingId = params.id as string;

  const [item, setItem] = useState<LeadRoutingPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [openingTitle, setOpeningTitle] = useState(false);
  const [pickingLostReason, setPickingLostReason] = useState(false);

  const loadLead = async () => {
    try {
      if (!leadRoutingId) throw new Error('No lead ID provided');

      const { data, error } = await supabase.rpc('get_my_lead_routings');
      if (error) throw error;

      const match = ((data as LeadRoutingPreview[]) || []).find(
        (row) => row.lead_routing_id === leadRoutingId
      );
      if (!match) throw new Error('Lead not found');

      setItem(match);
    } catch (err) {
      console.error('Error loading lead:', err);
      Alert.alert('Error', 'Failed to load lead details');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadLead();
  }, [leadRoutingId]);

  const handleClaim = async () => {
    if (!item) return;
    try {
      setClaiming(true);
      const { data, error } = await supabase.rpc('claim_lead', {
        p_lead_routing_id: item.lead_routing_id,
      });
      if (error) throw error;

      if (data === true) {
        await loadLead();
      } else {
        Alert.alert(
          'Already connected',
          'This lead has already been connected with enough professionals.'
        );
        await loadLead();
      }
    } catch (err) {
      console.error('Error claiming lead:', err);
      Alert.alert('Error', 'Failed to claim this lead');
    } finally {
      setClaiming(false);
    }
  };

  const handleStatusUpdate = async (
    newStatus: 'contacted' | 'in_talks' | 'converted' | 'lost',
    lostReason?: string
  ) => {
    if (!item) return;
    try {
      setUpdatingStatus(true);

      const updates: Record<string, unknown> = { status: newStatus };
      if (newStatus === 'lost') updates.lost_reason = lostReason || null;

      const { error } = await supabase
        .from('lead_routings')
        .update(updates)
        .eq('id', item.lead_routing_id);

      if (error) throw error;

      setItem((prev) => (prev ? { ...prev, status: newStatus, lost_reason: lostReason } : null));
      setPickingLostReason(false);
      Alert.alert('Updated', `Lead marked as ${STATUS_LABELS[newStatus]}`);
    } catch (err) {
      console.error('Error updating lead:', err);
      Alert.alert('Error', 'Failed to update lead');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleCall = () => {
    if (item?.consumer_phone) {
      Linking.openURL(`tel:${item.consumer_phone}`);
    } else {
      Alert.alert('No Phone Number', 'This lead did not provide a phone number');
    }
  };

  const handleEmail = () => {
    if (item?.consumer_email) {
      Linking.openURL(`mailto:${item.consumer_email}`);
    }
  };

  // The bucket is private, so viewing the file means signing a short-lived
  // URL on demand rather than storing/using a public one. RLS (migration
  // 017) only allows this for a broker with an actual claimed lead_routings
  // row for this report, matching the same scoping the badge itself relies
  // on — title_url itself only ever comes back non-null once claimed (see
  // get_my_lead_routings, migration 038).
  const handleViewTitle = async () => {
    if (!item?.title_url) return;
    try {
      setOpeningTitle(true);
      const { data, error } = await supabase.storage
        .from('property-documents')
        .createSignedUrl(item.title_url, 300);
      if (error || !data?.signedUrl) throw error || new Error('No signed URL returned');
      Linking.openURL(data.signedUrl);
    } catch (err) {
      console.error('Error opening title document:', err);
      Alert.alert('Error', 'Failed to open the title document');
    } finally {
      setOpeningTitle(false);
    }
  };

  const showTitleBadgeInfo = () => Alert.alert('About the title badge', BROKER_DISCLAIMER_TEXT);

  if (loading) {
    return (
      <SafeAreaWrapper>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.color.accent} />
        </View>
      </SafeAreaWrapper>
    );
  }

  if (!item) {
    return (
      <SafeAreaWrapper>
        <View style={styles.container}>
          <Text style={styles.error}>Lead not found</Text>
          <Button title="Go Back" onPress={() => router.back()} />
        </View>
      </SafeAreaWrapper>
    );
  }

  const claimed = item.claim_status === 'claimed';
  const full = !claimed && isAlreadyFull(item);

  return (
    <SafeAreaWrapper scrollable onBackPress={() => router.back()}>
      {/* Header */}
      <View style={styles.header}>
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

      {/* Property Information — masked (type/area/range) until claimed, real
          address/value once claimed. */}
      <Card variant="elevated" style={styles.propertyCard}>
        {claimed ? (
          <>
            <Text style={styles.propertyAddress}>{item.property_address}</Text>
            <Text style={styles.propertyValue}>
              {formatCurrency(item.estimated_value || 0, item.city_country)}
            </Text>
            <Text style={styles.propertyMeta}>Estimated valuation based on comparable sales</Text>
          </>
        ) : (
          <>
            <Text style={styles.propertyAddress}>
              {item.property_type || 'Property'} in {item.city_name || 'your area'}
              {item.city_state ? `, ${item.city_state}` : ''}
            </Text>
            <Text style={styles.propertyValue}>
              {item.estimated_value_low != null && item.estimated_value_high != null
                ? `${formatCurrency(item.estimated_value_low, item.city_country)} – ${formatCurrency(item.estimated_value_high, item.city_country)}`
                : 'Price range unavailable'}
            </Text>
            <Text style={styles.propertyMeta}>
              {item.condition ? `${item.condition} condition` : ''}
              {item.bedrooms != null ? ` · ${item.bedrooms} bed` : ''}
              {item.bathrooms != null ? ` · ${item.bathrooms} bath` : ''}
            </Text>
          </>
        )}
        {item.has_title_on_file ? (
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
      </Card>

      {!claimed && !full && (
        <>
          <Text style={styles.claimExplainer}>
            You'll see this homeowner's contact details as soon as you claim this lead.
          </Text>
          <Button
            title={claiming ? 'Claiming…' : 'I Want This Lead'}
            size="large"
            onPress={handleClaim}
            disabled={claiming}
            style={{ marginBottom: 24 }}
          />
        </>
      )}

      {!claimed && full && (
        <Card variant="outlined" style={styles.fullNoticeCard}>
          <Text style={styles.fullNoticeTitle}>Already connected</Text>
          <Text style={styles.fullNoticeText}>
            This homeowner has already connected with enough professionals. There's nothing more to
            do here — check back for new leads in your inbox.
          </Text>
        </Card>
      )}

      {claimed && item.status === 'revoked' && (
        <Card variant="outlined" style={styles.revokedCard}>
          <Text style={styles.revokedTitle}>This homeowner asked you to stop</Text>
          <Text style={styles.revokedText}>
            They've withdrawn their request to connect with you specifically. Please don't contact
            them further about this lead — continuing to do so is a violation of your broker
            agreement with Appraisal Online.
          </Text>
        </Card>
      )}

      {claimed && (
        <>
          {/* Consumer Information */}
          <Text style={styles.sectionTitle}>Consumer Information</Text>

          <Card variant="default" style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{item.consumer_email}</Text>
            </View>
            {!!item.consumer_phone && (
              <>
                <View style={styles.divider} />
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Phone</Text>
                  <Text style={styles.infoValue}>{item.consumer_phone}</Text>
                </View>
              </>
            )}
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Claimed</Text>
              <Text style={styles.infoValue}>
                {item.claimed_at ? new Date(item.claimed_at).toLocaleDateString() : '—'}
              </Text>
            </View>
          </Card>

          {/* Seller Details — Clause 5/6 of the Sep 1 spec. Only ever set if
              the consumer opted in to broker contact; otherwise every field
              here reads "Not answered" / no title. */}
          <View style={styles.sectionTitleRow}>
            <Text style={[styles.sectionTitle, { marginTop: 0, marginBottom: 0 }]}>Seller Details</Text>
            <TouchableOpacity onPress={showTitleBadgeInfo}>
              <Text style={styles.infoIcon}>ⓘ</Text>
            </TouchableOpacity>
          </View>

          <Card variant="default" style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Owner of property</Text>
              <Text style={styles.infoValue}>{yesNoLabel(item.is_owner)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Selling</Text>
              <Text style={styles.infoValue}>{yesNoLabel(item.intends_to_sell)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Land title</Text>
              {item.title_url ? (
                <TouchableOpacity onPress={handleViewTitle} disabled={openingTitle}>
                  <Text style={styles.titleLink}>{openingTitle ? 'Opening…' : '✓ On file — View'}</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.infoValueMuted}>Not provided</Text>
              )}
            </View>
          </Card>

          {/* Contact Actions */}
          <Text style={styles.sectionTitle}>Contact Actions</Text>

          <View style={styles.actionButtons}>
            <Button
              title="📧 Send Email"
              variant="secondary"
              size="large"
              onPress={handleEmail}
              style={{ flex: 1, marginRight: 8 }}
            />
            <Button
              title="☎️ Call"
              variant="secondary"
              size="large"
              onPress={handleCall}
              disabled={!item.consumer_phone}
              style={{ flex: 1 }}
            />
          </View>

          {/* Comparable Sales (if available) */}
          {!!item.comparables?.length && (
            <>
              <Text style={styles.sectionTitle}>Comparable Sales</Text>
              {item.comparables.map((comp: any, index: number) => (
                <Card key={index} variant="default" style={styles.comparableCard}>
                  <Text style={styles.comparableAddress}>{comp.address}</Text>
                  <View style={styles.comparableDetails}>
                    <View style={styles.comparableDetail}>
                      <Text style={styles.comparableDetailLabel}>Sale Price</Text>
                      <Text style={styles.comparableDetailValue}>
                        {formatCurrency(comp.sale_price, item.city_country)}
                      </Text>
                    </View>
                    <View style={styles.comparableDetail}>
                      <Text style={styles.comparableDetailLabel}>Distance</Text>
                      <Text style={styles.comparableDetailValue}>
                        {comp.distance_miles?.toFixed(1)} mi
                      </Text>
                    </View>
                    <View style={styles.comparableDetail}>
                      <Text style={styles.comparableDetailLabel}>Similarity</Text>
                      <Text style={styles.comparableDetailValue}>
                        {(comp.similarity_score * 100).toFixed(0)}%
                      </Text>
                    </View>
                  </View>
                </Card>
              ))}
            </>
          )}

          {/* Status Update Actions — not offered on a revoked lead; the
              homeowner has asked this broker to stop, not to keep working
              the pipeline. */}
          {item.status !== 'revoked' && (
            <>
              <Text style={styles.sectionTitle}>Update Lead Status</Text>

              <View style={styles.statusActions}>
                {item.status !== 'contacted' && (
                  <Button
                    title="Mark as Contacted"
                    variant="outline"
                    size="medium"
                    onPress={() => handleStatusUpdate('contacted')}
                    disabled={updatingStatus}
                    style={{ flex: 1, marginRight: 8, marginBottom: 8 }}
                  />
                )}
                {item.status !== 'in_talks' && (
                  <Button
                    title="Mark as In Talks"
                    variant="outline"
                    size="medium"
                    onPress={() => handleStatusUpdate('in_talks')}
                    disabled={updatingStatus}
                    style={{ flex: 1, marginBottom: 8 }}
                  />
                )}
                {item.status !== 'converted' && (
                  <Button
                    title="Mark as Converted"
                    variant="outline"
                    size="medium"
                    onPress={() => handleStatusUpdate('converted')}
                    disabled={updatingStatus}
                    style={{ flex: 1, marginRight: 8 }}
                  />
                )}
                {item.status !== 'lost' && (
                  <Button
                    title="Mark as Lost"
                    variant="outline"
                    size="medium"
                    onPress={() => setPickingLostReason(true)}
                    disabled={updatingStatus}
                    style={{ flex: 1 }}
                  />
                )}
              </View>

              {pickingLostReason && (
                <Card variant="outlined" style={styles.lostReasonCard}>
                  <Text style={styles.lostReasonTitle}>What happened?</Text>
                  <View style={styles.lostReasonOptions}>
                    {LOST_REASON_OPTIONS.map((opt) => (
                      <TouchableOpacity
                        key={opt.value}
                        style={styles.lostReasonOption}
                        onPress={() => handleStatusUpdate('lost', opt.value)}
                        disabled={updatingStatus}
                      >
                        <Text style={styles.lostReasonOptionText}>{opt.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TouchableOpacity onPress={() => setPickingLostReason(false)}>
                    <Text style={styles.lostReasonCancel}>Cancel</Text>
                  </TouchableOpacity>
                </Card>
              )}
            </>
          )}

          {item.status === 'lost' && item.lost_reason && (
            <Text style={styles.lostReasonDisplay}>
              Reason: {LOST_REASON_OPTIONS.find((o) => o.value === item.lost_reason)?.label || item.lost_reason}
            </Text>
          )}

          {/* Notes Section */}
          <Card variant="outlined" style={styles.notesCard}>
            <Text style={styles.notesTitle}>💡 Notes</Text>
            <Text style={styles.notesText}>
              Keep track of your communication with this lead in your CRM or notes app. Reference this
              lead ID: {item.lead_id.slice(0, 8)}...
            </Text>
          </Card>
        </>
      )}

      <View style={styles.bottomPadding} />
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  error: {
    fontSize: 16,
    color: theme.color.danger,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 20,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
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
    fontSize: 12,
    fontWeight: '700',
    color: theme.color.text,
  },
  propertyCard: {
    marginBottom: 16,
    alignItems: 'center',
  },
  propertyAddress: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.color.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  propertyValue: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.color.success,
    marginBottom: 4,
    textAlign: 'center',
  },
  propertyMeta: {
    fontSize: 13,
    color: theme.color.textMuted,
    textAlign: 'center',
  },
  titleBadge: {
    alignSelf: 'center',
    backgroundColor: '#DCFCE7',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginTop: 10,
  },
  titleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
  },
  titleBadgeMuted: {
    alignSelf: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.color.border,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginTop: 10,
  },
  titleBadgeMutedText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.color.textFaint,
  },
  nicheTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
    justifyContent: 'center',
  },
  nicheTag: {
    backgroundColor: '#EDE9FE',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  nicheTagText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5B21B6',
  },
  claimExplainer: {
    fontSize: 13,
    color: theme.color.textMuted,
    textAlign: 'center',
    marginBottom: 12,
  },
  fullNoticeCard: {
    marginBottom: 24,
    backgroundColor: theme.color.surface,
  },
  fullNoticeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.color.text,
    marginBottom: 6,
  },
  fullNoticeText: {
    fontSize: 14,
    color: theme.color.textMuted,
    lineHeight: 20,
  },
  revokedCard: {
    marginBottom: 24,
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  revokedTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#991B1B',
    marginBottom: 6,
  },
  revokedText: {
    fontSize: 14,
    color: '#7F1D1D',
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.color.text,
    marginBottom: 12,
    marginTop: 20,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 20,
    marginBottom: 12,
  },
  infoIcon: {
    fontSize: 15,
    color: theme.color.textFaint,
    fontWeight: '700',
  },
  infoCard: {
    marginBottom: 24,
  },
  infoRow: {
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 14,
    color: theme.color.textMuted,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 14,
    color: theme.color.text,
    fontWeight: '600',
  },
  infoValueMuted: {
    fontSize: 14,
    color: theme.color.textFaint,
    fontWeight: '600',
  },
  titleLink: {
    fontSize: 14,
    color: '#166534',
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: theme.color.border,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  comparableCard: {
    marginBottom: 12,
  },
  comparableAddress: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.color.text,
    marginBottom: 12,
  },
  comparableDetails: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  comparableDetail: {
    alignItems: 'center',
  },
  comparableDetailLabel: {
    fontSize: 12,
    color: theme.color.textFaint,
    fontWeight: '600',
    marginBottom: 2,
  },
  comparableDetailValue: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.color.text,
  },
  statusActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  lostReasonCard: {
    marginBottom: 24,
  },
  lostReasonTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.color.text,
    marginBottom: 10,
  },
  lostReasonOptions: {
    gap: 8,
    marginBottom: 12,
  },
  lostReasonOption: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  lostReasonOptionText: {
    fontSize: 14,
    color: theme.color.text,
    fontWeight: '600',
  },
  lostReasonCancel: {
    fontSize: 13,
    color: theme.color.textMuted,
    textAlign: 'center',
  },
  lostReasonDisplay: {
    fontSize: 13,
    color: theme.color.textMuted,
    marginBottom: 16,
  },
  notesCard: {
    backgroundColor: theme.color.surface,
    borderColor: theme.color.border,
    marginBottom: 24,
    marginTop: 20,
  },
  notesTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.color.text,
    marginBottom: 8,
  },
  notesText: {
    fontSize: 14,
    color: theme.color.textMuted,
    lineHeight: 20,
  },
  bottomPadding: {
    height: 32,
  },
});
