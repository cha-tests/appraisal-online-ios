import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaWrapper } from '../../components/layout/SafeAreaWrapper';
import { Button } from '../../components/ui/Button';
import { TextInput } from '../../components/ui/TextInput';
import { Card } from '../../components/ui/Card';
import { authService } from '../../services/auth.service';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [step, setStep] = useState<'email' | 'code' | 'password'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const validateEmail = () => {
    if (!email) {
      setError('Email is required');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email');
      return false;
    }
    return true;
  };

  const validateCode = () => {
    if (!code || code.length < 6) {
      setError('Please enter the 6-digit code');
      return false;
    }
    return true;
  };

  const validatePassword = () => {
    if (!newPassword || newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return false;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    return true;
  };

  const handleSendCode = async () => {
    if (!validateEmail()) return;

    try {
      setLoading(true);
      setError('');

      const result = await authService.requestPasswordReset(email);

      if (result.success) {
        Alert.alert('Success', `Password reset link sent to ${email}. Check your email.`);
        setStep('password');
      } else {
        setError(result.error || 'Failed to send reset code');
      }
    } catch (err) {
      setError('Failed to send reset code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!validateCode()) return;

    try {
      setLoading(true);
      setError('');

      // Verify the OTP code
      const result = await authService.verifyOTP(email, code);

      if (result.success) {
        setStep('password');
      } else {
        setError(result.error || 'Invalid code. Please try again.');
      }
    } catch (err) {
      setError('Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!validatePassword()) return;

    try {
      setLoading(true);
      setError('');

      // Update password via Supabase
      const result = await authService.updatePassword(newPassword);

      if (result.success) {
        Alert.alert('Success', 'Your password has been reset. Please sign in.');
        router.push('/auth/login');
      } else {
        setError(result.error || 'Failed to reset password');
      }
    } catch (err) {
      setError('Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaWrapper scrollable>
      {/* Header */}
      <View style={styles.header}>
        <Button
          title="← Back"
          variant="outline"
          size="small"
          onPress={() => router.back()}
          style={{ alignSelf: 'flex-start', marginBottom: 20 }}
        />
        <Text style={styles.title}>Reset Password</Text>
        <Text style={styles.subtitle}>
          {step === 'email' && 'Enter your email address'}
          {step === 'code' && 'Enter the verification code'}
          {step === 'password' && 'Create a new password'}
        </Text>
      </View>

      {/* Error Message */}
      {error ? (
        <Card variant="outlined" style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </Card>
      ) : null}

      {/* Step 1: Email */}
      {step === 'email' && (
        <View style={styles.form}>
          <TextInput
            placeholder="Email Address"
            value={email}
            onChangeText={(val) => {
              setEmail(val);
              setError('');
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!loading}
          />

          <Button
            title={loading ? 'Sending...' : 'Send Reset Code'}
            size="large"
            onPress={handleSendCode}
            disabled={loading}
            style={{ marginTop: 20 }}
          />
        </View>
      )}

      {/* Step 2: Code */}
      {step === 'code' && (
        <View style={styles.form}>
          <Card variant="outlined" style={styles.infoCard}>
            <Text style={styles.infoText}>
              We sent a 6-digit code to {email}. Check your email and enter it below.
            </Text>
          </Card>

          <TextInput
            placeholder="000000"
            value={code}
            onChangeText={(val) => {
              setCode(val.replace(/\D/g, '').slice(0, 6));
              setError('');
            }}
            keyboardType="number-pad"
            maxLength={6}
            editable={!loading}
            style={{ marginTop: 12 }}
          />

          <Button
            title={loading ? 'Verifying...' : 'Verify Code'}
            size="large"
            onPress={handleVerifyCode}
            disabled={loading}
            style={{ marginTop: 20 }}
          />

          <Button
            title="Didn't receive code? Resend"
            variant="outline"
            size="small"
            onPress={handleSendCode}
            disabled={loading}
            style={{ marginTop: 12 }}
          />
        </View>
      )}

      {/* Step 3: New Password */}
      {step === 'password' && (
        <View style={styles.form}>
          <TextInput
            placeholder="New Password (min 8 characters)"
            value={newPassword}
            onChangeText={(val) => {
              setNewPassword(val);
              setError('');
            }}
            secureTextEntry
            editable={!loading}
          />

          <TextInput
            placeholder="Confirm Password"
            value={confirmPassword}
            onChangeText={(val) => {
              setConfirmPassword(val);
              setError('');
            }}
            secureTextEntry
            editable={!loading}
            style={{ marginTop: 12 }}
          />

          <Button
            title={loading ? 'Resetting...' : 'Reset Password'}
            size="large"
            onPress={handleResetPassword}
            disabled={loading}
            style={{ marginTop: 20 }}
          />
        </View>
      )}

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Remember your password? </Text>
        <Button
          title="Sign In"
          variant="outline"
          size="small"
          onPress={() => router.push('/auth/login')}
        />
      </View>
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  form: {
    marginBottom: 24,
  },
  errorCard: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
  },
  infoCard: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BFDBFE',
  },
  infoText: {
    fontSize: 14,
    color: '#1F2937',
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  footerText: {
    fontSize: 14,
    color: '#6B7280',
  },
});
