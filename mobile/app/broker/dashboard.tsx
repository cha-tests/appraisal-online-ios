import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaWrapper } from '../../components/layout/SafeAreaWrapper';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useAuthStore } from '../../stores/auth.store';
import { brokerService } from '../../services/broker.service';
import { subscriptionService } from '../../services/subscription.service';
import { supabase } from '../../services/supabase';
import { Lead, BrokerProfile, Subscription } from '../../types';

interface DashboardMetrics {
  totalLeads: number;
  thisMonthLeads: number;
  conversionRate: number;
  averageLeadValue: number;
}

export default function BrokerDashboard() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [brokerProfile, setBrokerProfile] = useState<BrokerProfile | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [recentLeads, setRecentLeads] = useState<Lead[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refundInfo, setRefundInfo] = useState<{ daysRemaining: number; canRefund: boolean } | null>(null);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        if (!user?.id) return;

        setLoading(true);

        // Fetch broker profile
        const { profile } = await brokerService.getProfile(user.id);
        if (profile) {
          setBrokerProfile(profile);
        }

        // Fetch subscription
        const { subscription: sub } = await subscriptionService.getBrokerSubscription(user.id);
        if (sub) {
          setSubscription(sub);

          // Check refund eligibility
          const eligibility = await subscriptionService.checkRefundEligibility(user.id);
          setRefundInfo({
            daysRemaining: eligibility.daysSincePurchase
              ? Math.max(0, (eligibility.refundWindow || 30) - eligibility.daysSincePurchase)
              : 0,
            canRefund: eligibility.eligible,
          });
        }

        // Fetch recent leads for this broker
        const { data: leads } = await supabase
          .from('lead_routings')
          .select('*, lead:lead_id(*, consumer:consumer_id(email))')
          .eq('broker_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5);

        if (leads) {
          setRecentLeads(leads as any);
        }

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

    // Subscribe to real-time updates
    const leadsSubscription = supabase
      .channel(`broker_leads_${user?.id}`)
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
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Loading your dashboard...</Text>
        </View>
      </SafeAreaWrapper>
    );
  }

  const brokerName = brokerProfile?.company_name || 'Broker';

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
          onPress={() => router.push('/broker/profile')}
        >
          <Text style={styles.profileIcon}>👤</Text>
        </TouchableOpacity>
      </View>

      {/* Refund Window Alert (if applicable) */}
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
            <Text style={styles.metricValue}>${(metrics.averageLeadValue / 1000).toFixed(0)}K</Text>
            <Text style={styles.metricLabel}>Avg Lead Value</Text>
          </Card>
        </View>
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
          onPress={() => router.push('/broker/profile')}
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

      {/* Recent Leads */}
      <Text style={styles.sectionTitle}>Recent Leads</Text>

      {recentLeads.length > 0 ? (
        <FlatList
          data={recentLeads}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.leadCard}
              onPress={() => router.push(`/broker/lead-detail?id=${item.lead_id}`)}
              activeOpacity={0.7}
            >
              <View style={styles.leadCardHeader}>
                <Text style={styles.leadAddress}>{item.lead?.property_address || 'Property'}</Text>
                <Text style={styles.leadValue}>
                  ${(item.lead?.property_value ? item.lead.property_value / 100 : 0).toLocaleString()}
                </Text>
              </View>
              <View style={styles.leadCardFooter}>
                <Text style={styles.leadEmail}>{item.lead?.consumer_email || 'Unknown'}</Text>
                <Text style={styles.leadStatus}>{item.delivery_status}</Text>
              </View>
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
        />
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

      {/* Tips Section */}
      <Text style={styles.sectionTitle} style={{ marginTop: 32 }}>Quick Tips</Text>

      <Card variant="outlined" style={styles.tipCard}>
        <Text style={styles.tipIcon}>⚡</Text>
        <View style={styles.tipContent}>
          <Text style={styles.tipTitle}>Respond Quickly</Text>
          <Text style={styles.tipText}>Contact leads within 24 hours for best conversion</Text>
        </View>
      </Card>

      <Card variant="outlined" style={styles.tipCard}>
        <Text style={styles.tipIcon}>📸</Text>
        <View style={styles.tipContent}>
          <Text style={styles.tipTitle}>Complete Your Profile</Text>
          <Text style={styles.tipText}>Add a photo and bio to attract more connections</Text>
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

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
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
    color: '#1F2937',
    marginBottom: 8,
  },
  tierBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  tierText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
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
  refundAlertCard: {
    backgroundColor: '#ECFDF5',
    borderColor: '#BBDFD4',
    marginBottom: 20,
  },
  refundAlertTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#047857',
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
    color: '#2563EB',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: '#6B7280',
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
    color: '#6B7280',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  leadCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
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
    color: '#1F2937',
    flex: 1,
  },
  leadValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#10B981',
  },
  leadCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leadEmail: {
    fontSize: 13,
    color: '#6B7280',
  },
  leadStatus: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#F9FAFB',
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 6,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  viewAllContainer: {
    marginBottom: 24,
  },
  tipCard: {
    marginBottom: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
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
    color: '#1F2937',
    marginBottom: 2,
  },
  tipText: {
    fontSize: 13,
    color: '#6B7280',
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
