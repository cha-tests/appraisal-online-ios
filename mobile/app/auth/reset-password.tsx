import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { SafeAreaWrapper } from '../../components/layout/SafeAreaWrapper';
import { Button } from '../../components/ui/Button';
import { TextInput } from '../../components/ui/TextInput';
import { Card } from '../../components/ui/Card';
import { supabase } from '../../services/supabase';
import { authService } from '../../services/auth.service';

// Supabase's password-recovery email opens this screen with the session
// tokens in the URL's hash fragment (#access_token=...&refresh_token=...&
// type=recovery), not as query params — expo-router only resolves the path
// and ?query, so the fragment has to be read off the raw incoming URL and
// parsed by hand instead.
function parseFragmentParams(url: string): Record<string, string> {
  const hashIndex = url.indexOf('#');
  if (hashIndex === -1) return {};

  const params: Record<string, string> = {};
  for (const pair of url.slice(hashIndex + 1).split('&')) {
    if (!pair) continue;
    const [key, value] = pair.split('=');
    if (key) params[decodeURIComponent(key)] = decodeURIComponent(value || '');
  }
  return params;
}

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [establishing, setEstablishing] = useState(true);
  const [linkError, setLinkError] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const establishSession = async () => {
      const url = await Linking.getInitialURL();
      const params = url ? parseFragmentParams(url) : {};

      if (params.error) {
        setLinkError(
          (params.error_description || '').replace(/\+/g, ' ') ||
            'This reset link has expired or was already used. Please request a new one.'
        );
        setEstablishing(false);
        return;
      }

      if (!params.access_token || !params.refresh_token) {
        setLinkError('This reset link is invalid or incomplete. Please request a new one.');
        setEstablishing(false);
        return;
      }

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: params.access_token,
        refresh_token: params.refresh_token,
      });

      if (sessionError) {
        setLinkError('This reset link has expired or was already used. Please request a new one.');
      }
      setEstablishing(false);
    };

    establishSession();
  }, []);

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

  const handleSubmit = async () => {
    if (!validatePassword()) return;

    try {
      setSubmitting(true);
      setError('');

      const result = await authService.updatePassword(newPassword);

      if (result.success) {
        Alert.alert('Success', 'Your password has been reset. Please sign in.');
        router.replace('/auth/login');
      } else {
        setError(result.error?.message || 'Failed to reset password');
      }
    } catch (err) {
      setError('Failed to reset password');
    } finally {
      setSubmitting(false);
    }
  };

  if (establishing) {
    return (
      <SafeAreaWrapper>
        <View style={styles.centered}>
          <Text style={styles.subtitle}>Verifying your reset link…</Text>
        </View>
      </SafeAreaWrapper>
    );
  }

  if (linkError) {
    return (
      <SafeAreaWrapper>
        <View style={styles.centered}>
          <Text style={styles.title}>Link Expired</Text>
          <Text style={[styles.subtitle, { textAlign: 'center', marginTop: 8 }]}>{linkError}</Text>
          <Button
            title="Request a New Link"
            size="large"
            onPress={() => router.replace('/auth/forgot-password')}
            style={{ marginTop: 24, alignSelf: 'stretch' }}
          />
        </View>
      </SafeAreaWrapper>
    );
  }

  return (
    <SafeAreaWrapper scrollable>
      <View style={styles.header}>
        <Text style={styles.title}>Set New Password</Text>
        <Text style={styles.subtitle}>Create a new password for your account</Text>
      </View>

      {error ? (
        <Card variant="outlined" style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </Card>
      ) : null}

      <View style={styles.form}>
        <TextInput
          placeholder="New Password (min 8 characters)"
          value={newPassword}
          onChangeText={(val) => {
            setNewPassword(val);
            setError('');
          }}
          secureTextEntry
          editable={!submitting}
        />

        <TextInput
          placeholder="Confirm Password"
          value={confirmPassword}
          onChangeText={(val) => {
            setConfirmPassword(val);
            setError('');
          }}
          secureTextEntry
          editable={!submitting}
          style={{ marginTop: 12 }}
        />

        <Button
          title={submitting ? 'Resetting...' : 'Reset Password'}
          size="large"
          onPress={handleSubmit}
          disabled={submitting}
          style={{ marginTop: 20 }}
        />
      </View>
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
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
});
