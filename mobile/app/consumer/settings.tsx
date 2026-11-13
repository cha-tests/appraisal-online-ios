import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { SafeAreaWrapper } from '../../components/layout/SafeAreaWrapper';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Toggle } from '../../components/ui/Toggle';
import { LoadError } from '../../components/ui/LoadError';
import { useAuthStore } from '../../stores/auth.store';
import { supabase, signOut } from '../../services/supabase';
import { reportService } from '../../services/report.service';
import { withTimeout } from '../../services/withTimeout';
import { accountService } from '../../services/account.service';
import { ConnectedBrokerRouting } from '../../types';
import { consumerLeadStatusLabel } from '../../config/leadRoutingStatus';
import { REVOKE_REASON_OPTIONS } from '../../config/revokeReasons';
import { beginSignOut } from '../../utils/signOutGuard';
import { theme } from '../../theme';

// A lead with nobody claimed yet, this long after the first brokers were
// invited, gets a direct check-in prompt instead of just sitting there —
// the escalation system (migration 037) is already working on it in the
// background by this point (several 24h rounds in, if still silent), so
// this is "want to keep waiting on that, or call it off" rather than the
// first thing a homeowner sees.
const CHECK_IN_DAYS = 5;

type RevokeTarget = { type: 'broker'; leadRoutingId: string } | { type: 'lead'; leadId: string };

interface LeadGroup {
  leadId: string;
  propertyAddress: string;
  routings: ConnectedBrokerRouting[];
}

function brokerDisplayName(routing: ConnectedBrokerRouting): string {
  if (routing.broker_company_name) return routing.broker_company_name;
  const name = [routing.broker_first_name, routing.broker_last_name].filter(Boolean).join(' ');
  return name || 'A professional';
}

/** Canned-reason picker shown inline under a Revoke action — mirrors
 * lead-detail.tsx's broker-side lost-reason picker. */
function ReasonPicker({
  submitting,
  onSelect,
  onCancel,
}: {
  submitting: boolean;
  onSelect: (reason: string) => void;
  onCancel: () => void;
}) {
  return (
    <Card variant="outlined" style={styles.reasonCard}>
      <Text style={styles.reasonTitle}>Why are you revoking this?</Text>
      <View style={styles.reasonOptions}>
        {REVOKE_REASON_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={styles.reasonOption}
            onPress={() => onSelect(opt.value)}
            disabled={submitting}
          >
            <Text style={styles.reasonOptionText}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity onPress={onCancel} disabled={submitting}>
        <Text style={styles.reasonCancel}>Never mind</Text>
      </TouchableOpacity>
    </Card>
  );
}

export default function ConsumerSettings() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [notifications, setNotifications] = useState({
    email: true,
  });
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Broker contact is opted in per report (see broker-optins.tsx), and
  // each report can now be routed to several brokers independently
  // (migration 037) — "manage" means one row per routed broker, grouped by
  // property, not one row per report the way it used to be.
  const [connectedBrokers, setConnectedBrokers] = useState<ConnectedBrokerRouting[]>([]);
  const [loadingConnected, setLoadingConnected] = useState(true);
  const [connectedBrokersError, setConnectedBrokersError] = useState(false);
  const [revokingTarget, setRevokingTarget] = useState<RevokeTarget | null>(null);
  const [pickingReasonFor, setPickingReasonFor] = useState<RevokeTarget | null>(null);
  // Session-only — "Keep waiting" just hides the check-in prompt until the
  // next time settings is opened, not persisted anywhere.
  const [dismissedCheckIns, setDismissedCheckIns] = useState<Set<string>>(new Set());

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        if (!user?.id) return;

        setLoading(true);
        setLoadError(false);

        // Fetch user preferences from database
        const { data, error } = await withTimeout(
          supabase.from('users').select('preferences').eq('id', user.id).single()
        );

        if (data?.preferences) {
          setNotifications((prev) => ({
            ...prev,
            ...data.preferences,
          }));
        }
      } catch (err) {
        console.error('Error loading preferences:', err);
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    };

    loadPreferences();
  }, [user?.id, reloadToken]);

  const loadConnectedBrokers = async () => {
    try {
      if (!user?.id) return;

      setLoadingConnected(true);
      setConnectedBrokersError(false);
      const { success, brokers } = await withTimeout(reportService.getMyConnectedBrokers());
      if (success && brokers) {
        setConnectedBrokers(brokers);
      } else {
        setConnectedBrokersError(true);
      }
    } catch (err) {
      console.error('Error loading connected brokers:', err);
      setConnectedBrokersError(true);
    } finally {
      setLoadingConnected(false);
    }
  };

  useEffect(() => {
    loadConnectedBrokers();
  }, [user?.id]);

  const leadGroups: LeadGroup[] = React.useMemo(() => {
    const byLead = new Map<string, LeadGroup>();
    for (const routing of connectedBrokers) {
      const existing = byLead.get(routing.lead_id);
      if (existing) {
        existing.routings.push(routing);
      } else {
        byLead.set(routing.lead_id, {
          leadId: routing.lead_id,
          propertyAddress: routing.property_address,
          routings: [routing],
        });
      }
    }
    return Array.from(byLead.values());
  }, [connectedBrokers]);

  const submitRevoke = async (target: RevokeTarget, reason: string) => {
    try {
      setRevokingTarget(target);
      const result =
        target.type === 'broker'
          ? await reportService.revokeBrokerContact(target.leadRoutingId, reason)
          : await reportService.cancelRequestForLead(target.leadId, reason);

      if (result.success) {
        setPickingReasonFor(null);
        await loadConnectedBrokers();
      } else {
        Alert.alert('Error', result.error?.message || 'Failed to revoke broker contact');
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to revoke broker contact');
    } finally {
      setRevokingTarget(null);
    }
  };

  const dismissCheckIn = (leadId: string) => {
    setDismissedCheckIns((prev) => new Set(prev).add(leadId));
  };

  const handleSave = async () => {
    try {
      setSaveStatus('saving');

      if (!user?.id) {
        Alert.alert('Error', 'User not authenticated');
        setSaveStatus('idle');
        return;
      }

      // Save preferences to database
      const { error } = await supabase
        .from('users')
        .update({ preferences: notifications, updated_at: new Date().toISOString() })
        .eq('id', user.id);

      if (error) {
        throw error;
      }

      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
      Alert.alert('Success', 'Your preferences have been saved');
    } catch (err) {
      Alert.alert('Error', 'Failed to save preferences');
      setSaveStatus('idle');
      console.error('Save error:', err);
    }
  };

  const handleExportData = async () => {
    try {
      setExporting(true);
      const result = await accountService.exportMyData();
      if (!result.success || !result.data) {
        Alert.alert('Export Failed', result.error || 'Could not export your data. Please try again.');
        return;
      }

      const json = JSON.stringify(result.data, null, 2);
      const fileName = `appraisal-online-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, json);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          UTI: 'public.json',
        });
      } else {
        Alert.alert('Export Ready', 'Your data export was saved, but sharing is not available on this device.');
      }
    } catch (err) {
      console.error('Export error:', err);
      Alert.alert('Export Failed', 'Could not export your data. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const performAccountDeletion = async () => {
    try {
      setDeleting(true);
      // Guards against the stale-redirect race during sign-out (see
      // utils/signOutGuard.ts) — set before the network call, same as the
      // normal sign-out flow.
      beginSignOut();
      const result = await accountService.deleteMyAccount();

      if (result.success) {
        useAuthStore.getState().clear();
        router.replace('/welcome');
        return;
      }

      // Failure: nothing was cleared and the session is still valid, so
      // just surface the error and let the user try again.
      setDeleting(false);
      Alert.alert('Could Not Delete Account', result.error || 'Something went wrong. Please try again.');
    } catch (err) {
      setDeleting(false);
      Alert.alert('Could Not Delete Account', 'Something went wrong. Please try again.');
    }
  };

  // Irreversible action — never a single tap. First dialog states plainly
  // what does and doesn't happen; only after explicitly continuing does the
  // second, final dialog offer the actual destructive action.
  const handleRequestDeletion = () => {
    Alert.alert(
      'Delete Your Account?',
      "Your account and personal information will be deleted. Some anonymized records may be retained as required. This can't be undone.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', onPress: confirmAccountDeletion },
      ]
    );
  };

  const confirmAccountDeletion = () => {
    Alert.alert(
      'Confirm Account Deletion',
      "This is permanent. Once deleted, you won't be able to sign back in or recover your reports.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete My Account', style: 'destructive', onPress: performAccountDeletion },
      ]
    );
  };

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', onPress: () => {}, style: 'cancel' },
      {
        text: 'Sign Out',
        onPress: async () => {
          try {
            beginSignOut();
            await signOut();
            useAuthStore.getState().clear();
            router.replace('/welcome');
          } catch (err) {
            Alert.alert('Error', 'Failed to sign out. Please try again.');
          }
        },
        style: 'destructive',
      },
    ]);
  };

  if (loadError) {
    return (
      <SafeAreaWrapper>
        <LoadError
          message="Couldn't load your settings. Check your connection and try again."
          onRetry={() => setReloadToken((t) => t + 1)}
        />
      </SafeAreaWrapper>
    );
  }

  if (loading) {
    return (
      <SafeAreaWrapper>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.color.accent} />
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      </SafeAreaWrapper>
    );
  }

  return (
    <SafeAreaWrapper scrollable onBackPress={() => router.back()}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Settings & Privacy</Text>
      </View>

      {/* Notifications */}
      <Text style={styles.sectionTitle}>Notifications</Text>

      <Card variant="default" style={styles.preferencesCard}>
        <View style={styles.preferenceRow}>
          <View>
            <Text style={styles.preferenceLabel}>Email Notifications</Text>
            <Text style={styles.preferenceHelper}>Receive updates via email</Text>
          </View>
          <Toggle
            value={notifications.email}
            onToggle={(val) => setNotifications((prev) => ({ ...prev, email: val }))}
          />
        </View>
      </Card>

      {/* Broker Contact — one card per property, listing each professional
          routed to it individually (migration 037: a lead can now have
          several, each at their own stage), not one switch per report the
          way this used to work. */}
      <Text style={[styles.sectionTitle, { marginTop: 32 }]}>Broker Contact</Text>

      {loadingConnected ? (
        <ActivityIndicator color={theme.color.accent} style={{ marginVertical: 12 }} />
      ) : connectedBrokersError ? (
        <View style={styles.inlineErrorRow}>
          <Text style={styles.inlineErrorText}>Couldn't load this section.</Text>
          <TouchableOpacity onPress={loadConnectedBrokers}>
            <Text style={styles.inlineErrorRetry}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : leadGroups.length > 0 ? (
        <>
          <Text style={styles.brokerContactHelper}>
            Professionals you've requested to connect with, and where things stand with each.
          </Text>
          {leadGroups.map((group) => {
            const oldestInvite = group.routings.reduce(
              (min, r) => (r.invited_at < min ? r.invited_at : min),
              group.routings[0].invited_at
            );
            const daysSinceInvited = (Date.now() - new Date(oldestInvite).getTime()) / 86400000;
            const nobodyClaimedYet = group.routings.every((r) => r.claim_status === 'invited');
            const showCheckIn =
              nobodyClaimedYet && daysSinceInvited >= CHECK_IN_DAYS && !dismissedCheckIns.has(group.leadId);
            const pickingForThisLead =
              pickingReasonFor?.type === 'lead' && pickingReasonFor.leadId === group.leadId;

            return (
              <Card key={group.leadId} variant="default" style={styles.connectedReportCard}>
                <Text style={styles.connectedReportAddress} numberOfLines={1}>
                  {group.propertyAddress}
                </Text>

                {showCheckIn && (
                  <View style={styles.checkInBanner}>
                    <Text style={styles.checkInTitle}>Still waiting to hear back</Text>
                    <Text style={styles.checkInText}>
                      It's been {Math.floor(daysSinceInvited)} days and no one has connected yet. We're
                      still trying more professionals in the background — want to keep waiting, or
                      cancel this request?
                    </Text>
                    <View style={styles.checkInActions}>
                      <Button
                        title="Keep waiting"
                        variant="outline"
                        size="small"
                        onPress={() => dismissCheckIn(group.leadId)}
                        style={{ flex: 1, marginRight: 8 }}
                      />
                      <Button
                        title="Cancel this request"
                        variant="outline"
                        size="small"
                        onPress={() => setPickingReasonFor({ type: 'lead', leadId: group.leadId })}
                        style={{ flex: 1 }}
                      />
                    </View>
                  </View>
                )}

                {group.routings.map((routing) => {
                  const pickingForThisBroker =
                    pickingReasonFor?.type === 'broker' &&
                    pickingReasonFor.leadRoutingId === routing.lead_routing_id;
                  return (
                    <View key={routing.lead_routing_id}>
                      <View style={styles.connectedReportRow}>
                        <View style={styles.connectedReportInfo}>
                          <Text style={styles.brokerName} numberOfLines={1}>
                            {brokerDisplayName(routing)}
                          </Text>
                          <Text style={styles.connectedReportStatus}>
                            {consumerLeadStatusLabel(routing.claim_status, routing.status)}
                          </Text>
                        </View>
                        {routing.status !== 'revoked' && (
                          <Button
                            title="Revoke"
                            variant="outline"
                            size="small"
                            onPress={() =>
                              setPickingReasonFor({ type: 'broker', leadRoutingId: routing.lead_routing_id })
                            }
                            disabled={revokingTarget !== null}
                          />
                        )}
                      </View>
                      {pickingForThisBroker && (
                        <ReasonPicker
                          submitting={revokingTarget !== null}
                          onCancel={() => setPickingReasonFor(null)}
                          onSelect={(reason) =>
                            submitRevoke({ type: 'broker', leadRoutingId: routing.lead_routing_id }, reason)
                          }
                        />
                      )}
                    </View>
                  );
                })}

                {pickingForThisLead && (
                  <ReasonPicker
                    submitting={revokingTarget !== null}
                    onCancel={() => setPickingReasonFor(null)}
                    onSelect={(reason) => submitRevoke({ type: 'lead', leadId: group.leadId }, reason)}
                  />
                )}

                {!pickingForThisLead && (
                  <TouchableOpacity
                    onPress={() => setPickingReasonFor({ type: 'lead', leadId: group.leadId })}
                    disabled={revokingTarget !== null}
                  >
                    <Text style={styles.cancelAllLink}>Cancel entire request</Text>
                  </TouchableOpacity>
                )}
              </Card>
            );
          })}
        </>
      ) : (
        <Card variant="outlined" style={styles.emptyConnectedCard}>
          <Text style={styles.emptyConnectedText}>
            You haven't opted in to broker contact on any report.
          </Text>
        </Card>
      )}

      {/* Privacy */}
      <Text style={[styles.sectionTitle, { marginTop: 32 }]}>Privacy & Data</Text>

      <Card variant="outlined" style={styles.privacyCard}>
        <Text style={styles.privacyTitle}>Your Data</Text>
        <Text style={styles.privacyText}>
          We only share your information with professionals you've explicitly opted in to contact. We never sell your data.
        </Text>
      </Card>

      <Card variant="default" style={styles.actionCard}>
        <Text style={styles.actionTitle}>📥 Export My Data</Text>
        <Text style={styles.actionDescription}>
          Download all your reports and valuation history as a file you can keep
        </Text>
        <Button
          title={exporting ? 'Preparing Export...' : 'Export Data'}
          variant="outline"
          size="small"
          onPress={handleExportData}
          disabled={exporting}
          loading={exporting}
          style={{ marginTop: 12 }}
        />
      </Card>

      <Card variant="default" style={styles.actionCard}>
        <Text style={styles.actionTitle}>🗑️ Delete My Account</Text>
        <Text style={styles.actionDescription}>
          Permanently delete your account and personal information
        </Text>
        <Text style={styles.actionWarning}>
          This can't be undone. Some anonymized records may be retained as required.
        </Text>
        <Button
          title={deleting ? 'Deleting...' : 'Request Deletion'}
          variant="danger"
          size="small"
          onPress={handleRequestDeletion}
          disabled={deleting}
          loading={deleting}
          style={{ marginTop: 12 }}
        />
      </Card>

      {/* Legal */}
      <Text style={[styles.sectionTitle, { marginTop: 32 }]}>Legal</Text>

      <View style={styles.linkItem}>
        <Text style={styles.linkText}>
          📄 Terms of Service
        </Text>
        <Button
          title="View"
          variant="outline"
          size="small"
          onPress={() => router.push('/public/terms-of-service')}
        />
      </View>

      <View style={styles.linkItem}>
        <Text style={styles.linkText}>
          🔒 Privacy Policy
        </Text>
        <Button
          title="View"
          variant="outline"
          size="small"
          onPress={() => router.push('/public/privacy-policy')}
        />
      </View>

      {/* Save Button */}
      <View style={styles.footer}>
        <Button
          title={
            saveStatus === 'saved'
              ? '✓ Saved'
              : saveStatus === 'saving'
              ? 'Saving...'
              : 'Save Changes'
          }
          size="large"
          onPress={handleSave}
          disabled={saveStatus !== 'idle'}
          style={{ marginBottom: 12 }}
        />
        <Button
          title="Sign Out"
          variant="outline"
          size="large"
          onPress={handleSignOut}
        />
      </View>
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
    marginTop: 12,
    fontSize: 14,
    color: theme.color.textMuted,
  },
  inlineErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  inlineErrorText: {
    fontSize: 14,
    color: theme.color.textMuted,
  },
  inlineErrorRetry: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.color.accent,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.color.text,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.color.text,
    marginBottom: 12,
  },
  preferencesCard: {
    marginBottom: 12,
    paddingVertical: 16,
  },
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  preferenceLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.color.text,
    marginBottom: 4,
  },
  preferenceHelper: {
    fontSize: 13,
    color: theme.color.textMuted,
  },
  brokerContactHelper: {
    fontSize: 13,
    color: theme.color.textMuted,
    marginBottom: 12,
    lineHeight: 18,
  },
  connectedReportCard: {
    marginBottom: 10,
    paddingVertical: 12,
  },
  connectedReportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  connectedReportInfo: {
    flex: 1,
    marginRight: 12,
  },
  connectedReportAddress: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.color.text,
  },
  brokerName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.color.text,
    marginBottom: 2,
  },
  connectedReportStatus: {
    fontSize: 12,
    color: theme.color.textMuted,
    fontWeight: '600',
  },
  checkInBanner: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
  },
  checkInTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 4,
  },
  checkInText: {
    fontSize: 13,
    color: '#78350F',
    lineHeight: 18,
    marginBottom: 10,
  },
  checkInActions: {
    flexDirection: 'row',
  },
  cancelAllLink: {
    fontSize: 12,
    color: theme.color.textMuted,
    textAlign: 'center',
    marginTop: 12,
  },
  reasonCard: {
    marginTop: 8,
    marginBottom: 4,
  },
  reasonTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.color.text,
    marginBottom: 10,
  },
  reasonOptions: {
    gap: 8,
    marginBottom: 12,
  },
  reasonOption: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  reasonOptionText: {
    fontSize: 13,
    color: theme.color.text,
    fontWeight: '600',
  },
  reasonCancel: {
    fontSize: 13,
    color: theme.color.textMuted,
    textAlign: 'center',
  },
  emptyConnectedCard: {
    backgroundColor: theme.color.surface,
    marginBottom: 12,
  },
  emptyConnectedText: {
    fontSize: 14,
    color: theme.color.textMuted,
    textAlign: 'center',
  },
  privacyCard: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BFDBFE',
    marginBottom: 20,
  },
  privacyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.color.text,
    marginBottom: 8,
  },
  privacyText: {
    fontSize: 14,
    color: theme.color.textMuted,
    lineHeight: 20,
  },
  actionCard: {
    marginBottom: 12,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.color.text,
    marginBottom: 6,
  },
  actionDescription: {
    fontSize: 14,
    color: theme.color.textMuted,
    lineHeight: 20,
    marginBottom: 4,
  },
  actionWarning: {
    fontSize: 12,
    color: theme.color.textFaint,
    fontStyle: 'italic',
  },
  linkItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.color.border,
  },
  linkText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.color.text,
  },
  footer: {
    marginBottom: 32,
    marginTop: 32,
  },
});
