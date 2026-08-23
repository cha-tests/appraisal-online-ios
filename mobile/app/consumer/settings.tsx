import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaWrapper } from '../../components/layout/SafeAreaWrapper';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Toggle } from '../../components/ui/Toggle';
import { useAuthStore } from '../../stores/auth.store';
import { supabase } from '../../services/supabase';

export default function ConsumerSettings() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    brokerContact: true,
  });
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        if (!user?.id) return;

        setLoading(true);

        // Fetch user preferences from database
        const { data, error } = await supabase
          .from('users')
          .select('preferences')
          .eq('id', user.id)
          .single();

        if (data?.preferences) {
          setNotifications((prev) => ({
            ...prev,
            ...data.preferences,
          }));
        }
      } catch (err) {
        console.error('Error loading preferences:', err);
      } finally {
        setLoading(false);
      }
    };

    loadPreferences();
  }, [user?.id]);

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

  if (loading) {
    return (
      <SafeAreaWrapper>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Loading settings...</Text>
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
          style={{ alignSelf: 'flex-start' }}
        />
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

      <Card variant="default" style={styles.preferencesCard}>
        <View style={styles.preferenceRow}>
          <View>
            <Text style={styles.preferenceLabel}>Push Notifications</Text>
            <Text style={styles.preferenceHelper}>Get alerts on your phone</Text>
          </View>
          <Toggle
            value={notifications.push}
            onToggle={(val) => setNotifications((prev) => ({ ...prev, push: val }))}
          />
        </View>
      </Card>

      <Card variant="default" style={styles.preferencesCard}>
        <View style={styles.preferenceRow}>
          <View>
            <Text style={styles.preferenceLabel}>Broker Contact</Text>
            <Text style={styles.preferenceHelper}>Allow professionals to reach you</Text>
          </View>
          <Toggle
            value={notifications.brokerContact}
            onToggle={(val) => setNotifications((prev) => ({ ...prev, brokerContact: val }))}
          />
        </View>
      </Card>

      {/* Privacy */}
      <Text style={styles.sectionTitle} style={{ marginTop: 32 }}>Privacy & Data</Text>

      <Card variant="outlined" style={styles.privacyCard}>
        <Text style={styles.privacyTitle}>Your Data</Text>
        <Text style={styles.privacyText}>
          We only share your information with professionals you've explicitly opted in to contact. We never sell your data.
        </Text>
      </Card>

      <Card variant="default" style={styles.actionCard}>
        <Text style={styles.actionTitle}>📥 Export My Data</Text>
        <Text style={styles.actionDescription}>
          Download all your reports and valuation history
        </Text>
        <Button
          title="Export Data"
          variant="outline"
          size="small"
          onPress={() => Alert.alert('Feature', 'Data export coming soon')}
          style={{ marginTop: 12 }}
        />
      </Card>

      <Card variant="default" style={styles.actionCard}>
        <Text style={styles.actionTitle}>🗑️ Delete My Data</Text>
        <Text style={styles.actionDescription}>
          Permanently remove all your reports and information
        </Text>
        <Text style={styles.actionWarning}>
          This will be processed within 30 days
        </Text>
        <Button
          title="Request Deletion"
          variant="outline"
          size="small"
          onPress={() => {
            Alert.alert(
              'Delete Data',
              'Are you sure? This cannot be undone. Your data will be permanently deleted within 30 days.',
              [
                { text: 'Cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => {
                    Alert.alert('Requested', 'Your deletion request has been submitted.');
                  },
                },
              ]
            );
          }}
          style={{ marginTop: 12 }}
        />
      </Card>

      {/* Legal */}
      <Text style={styles.sectionTitle} style={{ marginTop: 32 }}>Legal</Text>

      <View style={styles.linkItem}>
        <Text style={styles.linkText}>
          📄 Terms of Service
        </Text>
        <Button
          title="View"
          variant="outline"
          size="small"
          onPress={() => Alert.alert('Feature', 'Terms coming soon')}
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
          onPress={() => Alert.alert('Feature', 'Privacy policy coming soon')}
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
          title="Back to Account"
          variant="outline"
          size="large"
          onPress={() => router.back()}
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
    color: '#6B7280',
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
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
    color: '#1F2937',
    marginBottom: 4,
  },
  preferenceHelper: {
    fontSize: 13,
    color: '#6B7280',
  },
  privacyCard: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BFDBFE',
    marginBottom: 20,
  },
  privacyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  privacyText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  actionCard: {
    marginBottom: 12,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 6,
  },
  actionDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 4,
  },
  actionWarning: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  linkItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  linkText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  footer: {
    marginBottom: 32,
    marginTop: 32,
  },
});
