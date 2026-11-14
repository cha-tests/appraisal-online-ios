import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Card } from './Card';
import { PRC_VERIFICATION_URL } from '../../config/disclaimers';
import { IconWarning } from './icons';

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
  /** Set once the caller's own validation has run and this wasn't
   * acknowledged — turns the card's border red and adds an inline warning
   * below the checkbox, same treatment as TextInput/PhoneInput's error. */
  error?: string;
}

export function DisclaimerNotice({
  title,
  text,
  showPrcLink,
  acknowledged,
  onToggleAcknowledged,
  error,
}: DisclaimerNoticeProps) {
  const isInteractive = onToggleAcknowledged !== undefined;

  return (
    <Card variant="outlined" style={[styles.card, !!error && styles.cardError]}>
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
          <View style={[styles.checkbox, acknowledged && styles.checkboxChecked, !!error && styles.checkboxError]}>
            {acknowledged && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.checkboxLabel}>I have read and understood this notice</Text>
        </TouchableOpacity>
      )}

      {!!error && (
        <View style={styles.errorRow}>
          <IconWarning size={14} color="#DC2626" strokeWidth={2} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
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
  cardError: {
    borderColor: '#DC2626',
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
  checkboxError: {
    borderColor: '#DC2626',
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
  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 10,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
});
