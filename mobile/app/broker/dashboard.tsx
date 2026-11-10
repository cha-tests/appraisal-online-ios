import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaWrapper } from '../../components/layout/SafeAreaWrapper';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useAuthStore } from '../../stores/auth.store';
import { brokerService } from '../../services/broker.service';
import { subscriptionService } from '../../services/subscription.service';
import { supabase } from '../../services/supabase';
import { BrokerProfile, Subscription, LeadRoutingPreview, LeadRoutingStatus } from '../../types';
import { formatCurrency, getCurrencySymbol } from '../../config/marketConfig';
import { LEAD_ROUTING_STATUS_LABELS } from '../../config/leadRoutingStatus';
import { theme } from '../../theme';

interface DashboardMetrics {
  totalLeads: number;
  thisMonthLeads: number;
  conversionRate: number;
  averageLeadValue: number;
}

const PIPELINE_STATUSES: LeadRoutingStatus[] = ['new', 'contacted', 'in_talks', 'converted', 'lost', 'revoked'];

type PipelineCounts = Record<LeadRoutingStatus, number>;

function countByStatus(leads: LeadRoutingPreview[]): PipelineCounts {
  const counts = { new: 0, contacted: 0, in_talks: 0, converted: 0, lost: 0, revoked: 0 };
  for (const lead of leads) counts[lead.status]++;
  return counts;
}

export default function BrokerDashboard() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [brokerProfile, setBrokerProfile] = useState<BrokerProfile | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [recentLeads, setRecentLeads] = useState<LeadRoutingPreview[]>([]);
  const [pipelineCounts, setPipelineCounts] = useState<PipelineCounts | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refundInfo, setRefundInfo] = useState<{ daysRemaining: number; canRefund: boolean } | null>(null);
  // Broker's own market, for the aggregate "Avg Lead Value" metric below —
  // per-lead values (see the recent-leads list) already use each lead's own
  // property country instead, since a broker's leads can span cities.
  const [countryCode, setCountryCode] = useState<string | null>(null);

  // "Avg Lead Value" below is shown abbreviated ("$5K"), which
  // formatCurrency isn't built for — it derives just the currency symbol
  // (₱, A$, £, S$, ...) for the broker's market instead, via the shared
  // static lookup (see marketConfig.ts's getCurrencySymbol for why — not
  // Intl.formatToParts, which crashes on-device).
  const currencySymbol = useMemo(() => getCurrencySymbol(countryCode), [countryCode]);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        if (!user?.id) return;

        setLoading(true);

        // Fetch broker profile
        const { profile } = await brokerService.getProfile(user.id);
        if (profile) {
          setBrokerProfile(profile);
          setCountryCode(await brokerService.getBrokerCountryCode(profile.selected_cities ?? []));
        }

        // Fetch subscription
        const { subscription: sub } = await subscriptionService.getBrokerSubscription(user.id);
        if (sub) {
          setSubscription(sub);

          // Check refund eligibility. `?? 0`, not `|| 0` / a truthy check —
          // daysSincePurchase is legitimately 0 on the day of purchase, and
          // a truthy check treated that as "no value", showing 0 days left
          // instead of the full window on day one.
          const eligibility = await subscriptionService.checkRefundEligibility(user.id);
          const daysSincePurchase = eligibility.daysSincePurchase ?? 0;
          setRefundInfo({
            daysRemaining: Math.max(0, (eligibility.refundWindow || 30) - daysSincePurchase),
            canRefund: eligibility.eligible,
          });
        }

        // Fetch recent leads for this broker — single source of truth
        // (migrations 037/038), PII fields null until claimed, same as
        // lead-inbox.tsx/lead-detail.tsx.
        const { data: leads, error: leadsError } = await supabase.rpc('get_my_lead_routings');
        if (leadsError) throw leadsError;
        const allLeads = (leads as LeadRoutingPreview[]) || [];
        setRecentLeads(allLeads.slice(0, 5));
        // Pipeline widget needs the full set, not just the 5-item preview
        // above, to show an accurate count per status.
        setPipelineCounts(countByStatus(allLeads));

        // Calculate metrics (mock data for now)
        setMetrics({
          totalLeads: 24,
          thisMonthLeads: 7,
          conversionRate: 28.5,
          averageLeadValue: 5000,
        });
      } catch (err) {
        console.error('Error loading dashboard:', err);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();

    // Subscribe to real-time updates. The channel name carries a random
    // suffix so a fast remount (React Strict Mode's double-invoke in web
    // dev, or quick back/forward navigation) never reuses the same channel
    // name before the previous one's async removeChannel() finishes — reusing
    // it hands back an already-subscribed channel, and calling .on() on that
    // throws "cannot add postgres_changes callbacks ... after subscribe()".
    const leadsSubscription = supabase
      .channel(`broker_leads_${user?.id}_${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lead_routings',
          filter: `broker_id=eq.${user?.id}`,
        },
        () => {
          loadDashboardData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(leadsSubscription);
    };
  }, [user?.id]);

  if (loading) {
    return (
      <SafeAreaWrapper>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.color.accent} />
          <Text style={styles.loadingText}>Loading your dashboard...</Text>
        </View>
      </SafeAreaWrapper>
    );
  }

  // Greet the person who signed up, not their company — first_name comes
  // from the sign-up form (see auth/signup.tsx), while company_name is the
  // business name collected later in broker/onboarding.tsx.
  const brokerName = user?.first_name || 'Broker';

  return (
    <SafeAreaWrapper scrollable>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.greeting}>Welcome back, {brokerName}! 👋</Text>
          {subscription && (
            <View style={styles.tierBadge}>
              <Text style={styles.tierText}>{subscription.tier}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={styles.profileButton}
          onPress={() => router.push('/broker/profile-summary')}
        >
          <Text style={styles.profileIcon}>👤</Text>
        </TouchableOpacity>
      </View>

      {/* KYC status — surfaced here, not just buried in Settings, since
          submitting verification and then hearing nothing is exactly the
          turnaround-anxiety failure mode this is meant to resolve. Shown
          only once something has actually been submitted (kyc_submitted_at)
          and isn't already approved — KYC is optional, so a broker who
          never submitted anything still sits at kyc_status 'pending' by DB
          default and shouldn't see a misleading "under review" banner. */}
      {brokerProfile?.kyc_status === 'rejected' && (
        <Card variant="outlined" style={styles.kycAlertCard}>
          <Text style={styles.kycAlertTitle}>⚠️ Verification needs another look</Text>
          <Text style={styles.kycAlertText}>
            {brokerProfile.kyc_rejection_reason || 'Your submitted documents could not be verified.'}
          </Text>
          <Text style={styles.kycAlertHelp}>
            Contact support@appraisalonline.com to resubmit your documents.
          </Text>
        </Card>
      )}
      {brokerProfile?.kyc_status === 'pending' && brokerProfile?.kyc_submitted_at && (
        <Card variant="outlined" style={styles.kycPendingCard}>
          <Text style={styles.kycPendingTitle}>⏳ Verification under review</Text>
          <Text style={styles.kycPendingText}>
            Submitted {new Date(brokerProfile.kyc_submitted_at).toLocaleDateString()} — we'll notify
            you once it's reviewed.
          </Text>
        </Card>
      )}

      {/* Key Metrics */}
      {metrics && (
        <View style={styles.metricsGrid}>
          <Card variant="default" style={styles.metricCard}>
            <Text style={styles.metricValue}>{metrics.thisMonthLeads}</Text>
            <Text style={styles.metricLabel}>Leads This Month</Text>
          </Card>
          <Card variant="default" style={styles.metricCard}>
            <Text style={styles.metricValue}>{metrics.conversionRate}%</Text>
            <Text style={styles.metricLabel}>Conversion Rate</Text>
          </Card>
          <Card variant="default" style={styles.metricCard}>
            <Text style={styles.metricValue}>{currencySymbol}{(metrics.averageLeadValue / 1000).toFixed(0)}K</Text>
            <Text style={styles.metricLabel}>Avg Lead Value</Text>
          </Card>
        </View>
      )}

      {/* Refund Window Alert (if applicable). Placed below the core metrics
          rather than above them — a broker opens this screen to check
          leads/metrics, not for a promotional-style banner, so it
          shouldn't outrank that data even though it's an important,
          time-sensitive notice. */}
      {refundInfo && refundInfo.canRefund && (
        <Card variant="outlined" style={styles.refundAlertCard}>
          <Text style={styles.refundAlertTitle}>💰 Money-Back Guarantee Active</Text>
          <Text style={styles.refundAlertText}>
            You have {refundInfo.daysRemaining} {refundInfo.daysRemaining === 1 ? 'day' : 'days'} left to request a refund if you're not satisfied.
          </Text>
          <Button
            title="Request Refund"
            variant="outline"
            size="small"
            onPress={() => router.push('/broker/refund-request')}
            style={{ marginTop: 12 }}
          />
        </Card>
      )}

      {/* Quick Actions */}
      <View style={styles.quickActionsGrid}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push('/broker/lead-inbox')}
        >
          <Text style={styles.actionIcon}>📬</Text>
          <Text style={styles.actionLabel}>Leads</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push('/broker/profile-summary')}
        >
          <Text style={styles.actionIcon}>🏢</Text>
          <Text style={styles.actionLabel}>Profile</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push('/broker/settings')}
        >
          <Text style={styles.actionIcon}>⚙️</Text>
          <Text style={styles.actionLabel}>Settings</Text>
        </TouchableOpacity>
      </View>

      {/* Lead Pipeline — real counts per status across every lead routed to
          this broker (not just the 5-item Recent Leads preview below).
          Each chip deep-links into the inbox pre-filtered to that status. */}
      <Text style={styles.sectionTitle}>Lead Pipeline</Text>

      {pipelineCounts && (
        <View style={styles.pipelineGrid}>
          {PIPELINE_STATUSES.map((status) => (
            <TouchableOpacity
              key={status}
              style={[styles.pipelineChip, pipelineChipStyles[status]]}
              onPress={() => router.push(`/broker/lead-inbox?status=${status}`)}
              activeOpacity={0.7}
            >
              <Text style={styles.pipelineChipCount}>{pipelineCounts[status]}</Text>
              <Text style={styles.pipelineChipLabel}>{LEAD_ROUTING_STATUS_LABELS[status]}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Recent Leads */}
      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Recent Leads</Text>

      {recentLeads.length > 0 ? (
        // A plain View/.map() here, not FlatList — this list never scrolls
        // on its own (it's a short preview inside the page's own
        // SafeAreaWrapper ScrollView), and nesting a VirtualizedList inside
        // a ScrollView of the same orientation is a React Native anti-
        // pattern that breaks windowing: on web it left a large block of
        // extra blank space below the list instead of sizing to content.
        <View>
          {recentLeads.map((item) => {
            const claimed = item.claim_status === 'claimed';
            const full = !claimed && item.requested_broker_count != null && item.claimed_count >= item.requested_broker_count;
            return (
              <TouchableOpacity
                key={item.lead_routing_id}
                style={styles.leadCard}
                onPress={() => router.push(`/broker/lead-detail?id=${item.lead_routing_id}`)}
                activeOpacity={0.7}
              >
                <View style={styles.leadCardHeader}>
                  <Text style={styles.leadAddress}>
                    {claimed
                      ? item.property_address || 'Property'
                      : `${item.property_type || 'Property'} in ${item.city_name || 'your area'}`}
                  </Text>
                  <Text style={styles.leadValue}>
                    {claimed
                      ? formatCurrency(item.estimated_value || 0, item.city_country)
                      : item.estimated_value_low != null && item.estimated_value_high != null
                      ? `${formatCurrency(item.estimated_value_low, item.city_country)}–${formatCurrency(item.estimated_value_high, item.city_country)}`
                      : ''}
                  </Text>
                </View>
                <View style={styles.leadCardFooter}>
                  <Text style={styles.leadEmail}>
                    {claimed ? item.consumer_email || 'Unknown' : full ? 'Already connected' : 'Tap to view & claim'}
                  </Text>
                  <Text style={styles.leadStatus}>{LEAD_ROUTING_STATUS_LABELS[item.status]}</Text>
                </View>
                {item.has_title_on_file && <Text style={styles.leadTitleBadge}>✓ Title on file</Text>}
              </TouchableOpacity>
            );
          })}
        </View>
      ) : (
        <Card variant="default" style={styles.emptyState}>
          <Text style={styles.emptyStateIcon}>📭</Text>
          <Text style={styles.emptyStateTitle}>No Leads Yet</Text>
          <Text style={styles.emptyStateText}>
            Leads will appear here when consumers in your cities opt in for professional contact.
          </Text>
        </Card>
      )}

      {/* View All Leads CTA */}
      {recentLeads.length > 0 && (
        <View style={styles.viewAllContainer}>
          <Button
            title="View All Leads"
            variant="outline"
            size="large"
            onPress={() => router.push('/broker/lead-inbox')}
          />
        </View>
      )}

      {/* Tips Section — one panel with a divider between items, matching
          the pattern used for similar item lists elsewhere in the app,
          rather than two separate cards that read as tappable options. */}
      <Text style={[styles.sectionTitle, { marginTop: 32 }]}>Quick Tips</Text>

      <Card variant="outlined" style={styles.tipsCard}>
        <View style={styles.tipRow}>
          <Text style={styles.tipIcon}>⚡</Text>
          <View style={styles.tipContent}>
            <Text style={styles.tipTitle}>Respond Quickly</Text>
            <Text style={styles.tipText}>Contact leads within 24 hours for best conversion</Text>
          </View>
        </View>

        <View style={styles.tipDivider} />

        <View style={styles.tipRow}>
          <Text style={styles.tipIcon}>📸</Text>
          <View style={styles.tipContent}>
            <Text style={styles.tipTitle}>Complete Your Profile</Text>
            <Text style={styles.tipText}>Add a photo and bio to attract more connections</Text>
          </View>
        </View>
      </Card>

      {/* Help & Support */}
      <Card variant="default" style={styles.supportCard}>
        <Text style={styles.supportTitle}>Need Help?</Text>
        <Text style={styles.supportText}>
          Email support@appraisalonline.com or tap the help icon anytime
        </Text>
      </Card>

      <View style={styles.bottomPadding} />
    </SafeAreaWrapper>
  );
}

// Keyed the same way as lead-inbox.tsx's status badge colors, so a status
// reads the same whether seen here or in the inbox list.
const pipelineChipStyles: Record<LeadRoutingStatus, { backgroundColor: string }> = {
  new: { backgroundColor: '#FEE2E2' },
  contacted: { backgroundColor: '#FEF3C7' },
  in_talks: { backgroundColor: '#DBEAFE' },
  converted: { backgroundColor: theme.color.successWash },
  lost: { backgroundColor: '#F3F4F6' },
  revoked: { backgroundColor: '#FECACA' },
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: theme.color.textMuted,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  headerContent: {
    flex: 1,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.color.text,
    marginBottom: 8,
  },
  tierBadge: {
    backgroundColor: theme.color.accentWash,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  tierText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.color.accent,
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileIcon: {
    fontSize: 24,
  },
  kycAlertCard: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    marginBottom: 20,
  },
  kycAlertTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#991B1B',
    marginBottom: 6,
  },
  kycAlertText: {
    fontSize: 14,
    color: '#7F1D1D',
    lineHeight: 20,
  },
  kycAlertHelp: {
    fontSize: 13,
    color: '#991B1B',
    marginTop: 8,
  },
  kycPendingCard: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    marginBottom: 20,
  },
  kycPendingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 6,
  },
  kycPendingText: {
    fontSize: 14,
    color: '#78350F',
    lineHeight: 20,
  },
  refundAlertCard: {
    backgroundColor: theme.color.successWash,
    borderColor: '#BBDFD4',
    marginBottom: 20,
  },
  refundAlertTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.color.successInk,
    marginBottom: 6,
  },
  refundAlertText: {
    fontSize: 14,
    color: '#065F46',
    lineHeight: 20,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  metricCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.color.accent,
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: theme.color.textMuted,
    textAlign: 'center',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  actionIcon: {
    fontSize: 28,
    marginBottom: 6,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.color.textMuted,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.color.text,
    marginBottom: 12,
  },
  pipelineGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  pipelineChip: {
    // ~3 per row with the 8px gap above, same sizing idea as metricCard.
    width: '31%',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  pipelineChipCount: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.color.text,
  },
  pipelineChipLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.color.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },
  leadCard: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    backgroundColor: theme.color.surface,
  },
  leadCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  leadAddress: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.color.text,
    flex: 1,
  },
  leadValue: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.color.success,
  },
  leadCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leadEmail: {
    fontSize: 13,
    color: theme.color.textMuted,
  },
  leadStatus: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.color.textFaint,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  leadTitleBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
    marginTop: 6,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: theme.color.surface,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.color.text,
    marginBottom: 6,
  },
  emptyStateText: {
    fontSize: 14,
    color: theme.color.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  viewAllContainer: {
    marginBottom: 24,
  },
  tipsCard: {
    marginBottom: 12,
    backgroundColor: theme.color.surface,
    borderColor: theme.color.border,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  tipDivider: {
    height: 1,
    backgroundColor: theme.color.border,
  },
  tipIcon: {
    fontSize: 20,
    marginRight: 12,
    marginTop: 2,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.color.text,
    marginBottom: 2,
  },
  tipText: {
    fontSize: 13,
    color: theme.color.textMuted,
    lineHeight: 18,
  },
  supportCard: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
    marginTop: 20,
    marginBottom: 24,
  },
  supportTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 6,
  },
  supportText: {
    fontSize: 14,
    color: '#78350F',
    lineHeight: 20,
  },
  bottomPadding: {
    height: 32,
  },
});
