import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Linking, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaWrapper } from '../../components/layout/SafeAreaWrapper';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { supabase } from '../../services/supabase';
import { Lead } from '../../types';

interface LeadDetail extends Lead {
  property_comparables?: any[];
  consumer_phone?: string;
}

export default function LeadDetail() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const leadId = params.id as string;

  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    const loadLeadDetail = async () => {
      try {
        if (!leadId) {
          throw new Error('No lead ID provided');
        }

        setLoading(true);

        // Fetch lead with property and report details
        const { data, error } = await supabase
          .from('leads')
          .select('*, property:property_id(*, report:id(comparables, estimated_value))')
          .eq('id', leadId)
          .single();

        if (error) throw error;
        if (data) {
          setLead(data as any);
        }
      } catch (err) {
        console.error('Error loading lead:', err);
        Alert.alert('Error', 'Failed to load lead details');
        router.back();
      } finally {
        setLoading(false);
      }
    };

    loadLeadDetail();
  }, [leadId]);

  const handleStatusUpdate = async (newStatus: 'contacted' | 'converted' | 'archived') => {
    try {
      setUpdatingStatus(true);

      const { error } = await supabase
        .from('leads')
        .update({ status: newStatus })
        .eq('id', leadId);

      if (error) throw error;

      setLead((prev) => (prev ? { ...prev, status: newStatus } : null));
      Alert.alert('Success', `Lead marked as ${newStatus}`);
    } catch (err) {
      console.error('Error updating lead:', err);
      Alert.alert('Error', 'Failed to update lead');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleCall = () => {
    if (lead?.consumer_phone) {
      Linking.openURL(`tel:${lead.consumer_phone}`);
    } else {
      Alert.alert('No Phone Number', 'This lead did not provide a phone number');
    }
  };

  const handleEmail = () => {
    if (lead?.consumer_email) {
      Linking.openURL(`mailto:${lead.consumer_email}`);
    }
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

  if (!lead) {
    return (
      <SafeAreaWrapper>
        <View style={styles.container}>
          <Text style={styles.error}>Lead not found</Text>
          <Button title="Go Back" onPress={() => router.back()} />
        </View>
      </SafeAreaWrapper>
    );
  }

  return (
    <SafeAreaWrapper scrollable>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <View
          style={[
            styles.statusBadge,
            lead.status === 'new' && styles.statusNew,
            lead.status === 'contacted' && styles.statusContacted,
            lead.status === 'converted' && styles.statusConverted,
          ]}
        >
          <Text style={styles.statusText}>{lead.status}</Text>
        </View>
      </View>

      {/* Property Information */}
      <Card variant="elevated" style={styles.propertyCard}>
        <Text style={styles.propertyAddress}>{lead.property_address}</Text>
        <Text style={styles.propertyValue}>
          ${(lead.property_value ? lead.property_value / 100 : 0).toLocaleString()}
        </Text>
        <Text style={styles.propertyMeta}>
          Estimated valuation based on comparable sales
        </Text>
      </Card>

      {/* Consumer Information */}
      <Text style={styles.sectionTitle}>Consumer Information</Text>

      <Card variant="default" style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Email</Text>
          <Text style={styles.infoValue}>{lead.consumer_email}</Text>
        </View>
        {lead.consumer_phone && (
          <>
            <View style={styles.divider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Phone</Text>
              <Text style={styles.infoValue}>{lead.consumer_phone}</Text>
            </View>
          </>
        )}
        <View style={styles.divider} />
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Received</Text>
          <Text style={styles.infoValue}>
            {new Date(lead.created_at).toLocaleDateString()}
          </Text>
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
          disabled={!lead.consumer_phone}
          style={{ flex: 1 }}
        />
      </View>

      {/* Comparable Sales (if available) */}
      {lead.property?.comparables && lead.property.comparables.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Comparable Sales</Text>
          {lead.property.comparables.map((comp: any, index: number) => (
            <Card key={index} variant="default" style={styles.comparableCard}>
              <Text style={styles.comparableAddress}>{comp.address}</Text>
              <View style={styles.comparableDetails}>
                <View style={styles.comparableDetail}>
                  <Text style={styles.comparableDetailLabel}>Sale Price</Text>
                  <Text style={styles.comparableDetailValue}>
                    ${(comp.sale_price / 100).toLocaleString()}
                  </Text>
                </View>
                <View style={styles.comparableDetail}>
                  <Text style={styles.comparableDetailLabel}>Distance</Text>
                  <Text style={styles.comparableDetailValue}>
                    {comp.distance_miles.toFixed(1)} mi
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

      {/* Status Update Actions */}
      <Text style={styles.sectionTitle}>Update Lead Status</Text>

      <View style={styles.statusActions}>
        {lead.status !== 'contacted' && (
          <Button
            title="Mark as Contacted"
            variant="outline"
            size="medium"
            onPress={() => handleStatusUpdate('contacted')}
            disabled={updatingStatus}
            style={{ flex: 1, marginRight: 8 }}
          />
        )}
        {lead.status !== 'converted' && (
          <Button
            title="Mark as Converted"
            variant="outline"
            size="medium"
            onPress={() => handleStatusUpdate('converted')}
            disabled={updatingStatus}
            style={{ flex: 1 }}
          />
        )}
      </View>

      {/* Notes Section */}
      <Card variant="outlined" style={styles.notesCard}>
        <Text style={styles.notesTitle}>💡 Notes</Text>
        <Text style={styles.notesText}>
          Keep track of your communication with this lead in your CRM or notes app. Reference this lead ID: {lead.id.slice(0, 8)}...
        </Text>
      </Card>

      {/* Archive Option */}
      {lead.status !== 'archived' && (
        <Button
          title="Archive Lead"
          variant="outline"
          size="large"
          onPress={() => handleStatusUpdate('archived')}
          disabled={updatingStatus}
        />
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
    color: '#EF4444',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    paddingRight: 16,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563EB',
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
  statusConverted: {
    backgroundColor: '#ECFDF5',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1F2937',
    textTransform: 'capitalize',
  },
  propertyCard: {
    marginBottom: 24,
    alignItems: 'center',
  },
  propertyAddress: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  propertyValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#10B981',
    marginBottom: 4,
  },
  propertyMeta: {
    fontSize: 13,
    color: '#6B7280',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
    marginTop: 20,
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
    color: '#6B7280',
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 14,
    color: '#1F2937',
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
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
    color: '#1F2937',
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
    color: '#9CA3AF',
    fontWeight: '600',
    marginBottom: 2,
  },
  comparableDetailValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  statusActions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  notesCard: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
    marginBottom: 24,
    marginTop: 20,
  },
  notesTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  notesText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  bottomPadding: {
    height: 32,
  },
});
