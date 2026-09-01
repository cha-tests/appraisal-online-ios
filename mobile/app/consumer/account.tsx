import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaWrapper } from '../../components/layout/SafeAreaWrapper';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useAuthStore } from '../../stores/auth.store';
import { useReportStore } from '../../stores/report.store';
import { reportService } from '../../services/report.service';
import { authService } from '../../services/auth.service';
import { Report } from '../../types';
import { formatCurrency } from '../../config/marketConfig';

export default function ConsumerAccount() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const clearAuth = useAuthStore((state) => state.clear);
  const setCurrentReport = useReportStore((state) => state.setCurrentReport);
  const setCurrentProperty = useReportStore((state) => state.setCurrentProperty);
  const [reports, setReports] = useState<Report[]>([]);
  const [allowance, setAllowance] = useState({ used: 0, remaining: 3 });
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [openingReportId, setOpeningReportId] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        if (!user?.id) return;

        setLoading(true);

        // Fetch user's reports
        const { success, reports: userReports } = await reportService.getUserReports(user.id);
        if (success && userReports) {
          setReports(userReports);
        }

        // Check free allowance
        const today = new Date();
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const monthDate = monthStart.toISOString().split('T')[0];

        const allowanceData = await reportService.checkReportAllowance(user.id);
        setAllowance({
          used: 3 - (allowanceData.remaining || 0),
          remaining: allowanceData.remaining || 0,
        });
      } catch (err) {
        console.error('Error loading account data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user?.id]);

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', onPress: () => {} },
      {
        text: 'Sign Out',
        onPress: async () => {
          try {
            setSigningOut(true);
            const result = await authService.signout();
            // signout() reports failure by returning success: false rather
            // than throwing, so this needs handling here or a failed sign out
            // leaves the user on the page with no feedback at all.
            if (!result.success) {
              Alert.alert('Error', result.error?.message ?? 'Failed to sign out');
              return;
            }
            // clear() rather than setUser(null) so the whole auth slice
            // (session, cached profile) goes with it.
            clearAuth();
            // replace, not push: the signed-in screens must not stay on the
            // history stack where Back could return to them after sign out.
            router.replace('/auth/login');
          } catch (err) {
            Alert.alert('Error', 'Failed to sign out');
          } finally {
            setSigningOut(false);
          }
        },
      },
    ]);
  };

  const handleViewReport = async (report: Report) => {
    try {
      setOpeningReportId(report.id);

      // report-view.tsx reads report/property from the store rather than
      // fetching by route param, so both need to be populated before
      // navigating there — getUserReports already returns full Report rows
      // (comparables included), but not the associated property, which
      // report-view.tsx needs for the comparable-sales distance unit
      // (see marketConfig.ts's formatDistance, keyed off country_code).
      const { success, property } = await reportService.getProperty(report.property_id);

      setCurrentReport(report);
      setCurrentProperty(success && property ? property : null);
      router.push('/consumer/report-view');
    } catch (err) {
      console.error('Error opening report:', err);
      Alert.alert('Error', 'Failed to open report');
    } finally {
      setOpeningReportId(null);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Deleting your account will remove all your data. This cannot be undone.',
      [
        { text: 'Cancel', onPress: () => {} },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Requested', 'Your account deletion request has been submitted. We will process it within 30 days.');
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaWrapper>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
        </View>
      </SafeAreaWrapper>
    );
  }

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
        <Text style={styles.title}>Your Account</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      {/* Free Reports Allowance */}
      <Card variant="elevated" style={styles.allowanceCard}>
        <Text style={styles.allowanceTitle}>Free Reports This Month</Text>
        <View style={styles.allowanceContent}>
          <View style={styles.allowanceCircle}>
            <Text style={styles.allowanceUsed}>{allowance.used}</Text>
            <Text style={styles.allowanceLabel}>used</Text>
          </View>
          <View style={styles.allowanceBar}>
            <View
              style={[
                styles.allowanceFill,
                {
                  width: `${(allowance.used / 3) * 100}%`,
                },
              ]}
            />
          </View>
          <View style={styles.allowanceCircle}>
            <Text style={styles.allowanceRemaining}>{allowance.remaining}</Text>
            <Text style={styles.allowanceLabel}>remaining</Text>
          </View>
        </View>
        <Text style={styles.allowanceHelper}>
          Free reports reset on the 1st of each month
        </Text>
      </Card>

      {/* Your Reports */}
      <Text style={styles.sectionTitle}>Your Reports</Text>

      {reports.length > 0 ? (
        <FlatList
          data={reports}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.reportCard}
              onPress={() => handleViewReport(item)}
              disabled={openingReportId === item.id}
              activeOpacity={0.7}
            >
              <View style={styles.reportCardContent}>
                <Text style={styles.reportAddress}>Report</Text>
                <Text style={styles.reportValue}>
                  {formatCurrency(item.estimated_value, item.gemini_response?.country_code)}
                </Text>
              </View>
              {openingReportId === item.id ? (
                <ActivityIndicator size="small" color="#9CA3AF" />
              ) : (
                <Text style={styles.reportDate}>
                  {new Date(item.created_at).toLocaleDateString()}
                </Text>
              )}
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
        />
      ) : (
        <Card variant="default" style={styles.emptyState}>
          <Text style={styles.emptyStateIcon}>📭</Text>
          <Text style={styles.emptyStateTitle}>No Reports Yet</Text>
          <Text style={styles.emptyStateText}>
            Start by getting a free valuation for your property
          </Text>
          <Button
            title="Get a Valuation"
            size="medium"
            onPress={() => router.push('/consumer/address-entry')}
            style={{ marginTop: 12 }}
          />
        </Card>
      )}

      {/* Settings */}
      <Text style={[styles.sectionTitle, { marginTop: 32 }]}>Settings</Text>

      <TouchableOpacity
        style={styles.settingItem}
        onPress={() => router.push('/consumer/settings')}
      >
        <View>
          <Text style={styles.settingLabel}>Privacy & Notifications</Text>
          <Text style={styles.settingHelper}>Manage your communication preferences</Text>
        </View>
        <Text style={styles.settingArrow}>→</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.settingItem}
        onPress={() => {
          Alert.alert('Coming Soon', 'Profile customization features are coming soon');
        }}
      >
        <View>
          <Text style={styles.settingLabel}>Profile</Text>
          <Text style={styles.settingHelper}>Update your name and contact info</Text>
        </View>
        <Text style={styles.settingArrow}>→</Text>
      </TouchableOpacity>

      {/* Help & Support */}
      <Card variant="outlined" style={styles.supportCard}>
        <Text style={styles.supportTitle}>Need Help?</Text>
        <Text style={styles.supportText}>
          Have questions about your valuations or professional contacts? Email us at support@appraisalonline.com
        </Text>
      </Card>

      {/* Account Actions */}
      <View style={styles.accountActions}>
        <Button
          title="Sign Out"
          variant="outline"
          size="large"
          onPress={handleSignOut}
          disabled={signingOut}
          style={{ marginBottom: 12 }}
        />
        <Button
          title="Delete Account"
          variant="danger"
          size="large"
          onPress={handleDeleteAccount}
          disabled={signingOut}
        />
      </View>

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
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: '#6B7280',
  },
  allowanceCard: {
    marginBottom: 24,
  },
  allowanceTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 16,
  },
  allowanceContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  allowanceCircle: {
    alignItems: 'center',
  },
  allowanceUsed: {
    fontSize: 24,
    fontWeight: '700',
    color: '#EF4444',
  },
  allowanceRemaining: {
    fontSize: 24,
    fontWeight: '700',
    color: '#10B981',
  },
  allowanceLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  allowanceBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  allowanceFill: {
    height: '100%',
    backgroundColor: '#EF4444',
    borderRadius: 4,
  },
  allowanceHelper: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  reportCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  reportCardContent: {
    flex: 1,
  },
  reportAddress: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  reportValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#10B981',
  },
  reportDate: {
    fontSize: 12,
    color: '#9CA3AF',
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
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 2,
  },
  settingHelper: {
    fontSize: 13,
    color: '#6B7280',
  },
  settingArrow: {
    fontSize: 18,
    color: '#D1D5DB',
  },
  supportCard: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
    marginBottom: 24,
    marginTop: 24,
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
  accountActions: {
    marginBottom: 32,
  },
  bottomPadding: {
    height: 32,
  },
});
