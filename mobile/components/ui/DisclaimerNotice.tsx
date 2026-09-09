import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Card } from './Card';
import { PRC_VERIFICATION_URL } from '../../config/disclaimers';

interface DisclaimerNoticeProps {
  title: string;
  text: string;
  /** Renders a live link to the PRC verification site under the text. */
  showPrcLink?: boolean;
  /**
   * When provided, renders a required "I have read and understood this
   * notice" checkbox wired to these props. Omit for a read-only display
   * (e.g. the report screen, or "view disclaimer" from a dashboard).
   */
  acknowledged?: boolean;
  onToggleAcknowledged?: (value: boolean) => void;
}

export function DisclaimerNotice({
  title,
  text,
  showPrcLink,
  acknowledged,
  onToggleAcknowledged,
}: DisclaimerNoticeProps) {
  const isInteractive = onToggleAcknowledged !== undefined;

  return (
    <Card variant="outlined" style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.text}>{text}</Text>

      {showPrcLink && (
        <TouchableOpacity onPress={() => Linking.openURL(PRC_VERIFICATION_URL)}>
          <Text style={styles.link}>Verify a license at prc.gov.ph &rarr;</Text>
        </TouchableOpacity>
      )}

      {isInteractive && (
        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => onToggleAcknowledged!(!acknowledged)}
          activeOpacity={0.7}
        >
          <View style={[styles.checkbox, acknowledged && styles.checkboxChecked]}>
            {acknowledged && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.checkboxLabel}>I have read and understood this notice</Text>
        </TouchableOpacity>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
    marginBottom: 16,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 8,
  },
  text: {
    fontSize: 13,
    color: '#78350F',
    lineHeight: 19,
  },
  link: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563EB',
    marginTop: 10,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#FCD34D',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#92400E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  checkboxChecked: {
    backgroundColor: '#92400E',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  checkboxLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#78350F',
    flex: 1,
  },
});
