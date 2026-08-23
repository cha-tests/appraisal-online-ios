import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaWrapper } from '../../components/layout/SafeAreaWrapper';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { authService } from '../../services/auth.service';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email?: string }>();
  const [resending, setResending] = useState(false);

  const handleResend = async () => {
    if (!email) return;

    try {
      setResending(true);
      const result = await authService.resendConfirmationEmail(email);

      if (result.success) {
        Alert.alert('Email Sent', 'Check your inbox for the confirmation link.');
      } else {
        Alert.alert('Resend Failed', result.error?.message || 'Unable to resend email');
      }
    } catch (err) {
      console.error('Resend error:', err);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaWrapper scrollable>
      <View style={styles.header}>
        <Text style={styles.icon}>📧</Text>
        <Text style={styles.title}>Verify Your Email</Text>
        <Text style={styles.subtitle}>
          We sent a confirmation link to{'\n'}
          <Text style={styles.email}>{email || 'your email address'}</Text>
        </Text>
      </View>

      <Card variant="outlined" style={styles.infoCard}>
        <Text style={styles.infoText}>
          Click the link in that email to activate your account, then come back and sign in.
        </Text>
      </Card>

      <Button
        title={resending ? 'Resending...' : 'Resend Confirmation Email'}
        variant="outline"
        size="large"
        onPress={handleResend}
        disabled={resending || !email}
        style={{ marginTop: 24 }}
      />

      <Button
        title="Back to Sign In"
        size="large"
        onPress={() => router.replace('/auth/login')}
        style={{ marginTop: 12 }}
      />
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
  header: {
    marginTop: 40,
    marginBottom: 24,
    alignItems: 'center',
  },
  icon: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  email: {
    fontWeight: '600',
    color: '#1F2937',
  },
  infoCard: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BFDBFE',
  },
  infoText: {
    fontSize: 13,
    color: '#1F2937',
    lineHeight: 18,
    textAlign: 'center',
  },
});
