import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaWrapper } from '../../components/layout/SafeAreaWrapper';
import { Button } from '../../components/ui/Button';
import { TextInput } from '../../components/ui/TextInput';
import { useAuthStore } from '../../stores/auth.store';
import { authService } from '../../services/auth.service';

export default function LoginScreen() {
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  const setBrokerProfile = useAuthStore((state) => state.setBrokerProfile);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validateForm = () => {
    const newErrors: typeof errors = {};

    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);
      const result = await authService.signin(email, password);

      if (result.success && result.user) {
        setUser(result.user);
        // Route based on user type
        if (result.user.user_type === 'broker') {
          // Established brokers go straight to their dashboard; brokers who
          // haven't completed onboarding yet see the application splash.
          const brokerProfile = result.session?.broker_profile;
          setBrokerProfile(brokerProfile ?? null);
          router.replace(brokerProfile ? '/broker/dashboard' : '/broker/splash');
        } else {
          router.replace('/consumer/home');
        }
      } else {
        const errorMessage = typeof result.error === 'object' && result.error?.message
          ? result.error.message
          : result.error || 'Invalid email or password';
        Alert.alert('Login Failed', errorMessage);
      }
    } catch (err) {
      console.error('Login error:', err);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaWrapper scrollable>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>Sign in to your account</Text>
      </View>

      {/* Form */}
      <View style={styles.form}>
        <TextInput
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!loading}
          error={errors.email}
        />

        <TextInput
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!loading}
          error={errors.password}
          style={{ marginTop: 12 }}
        />

        <Button
          title={loading ? 'Signing in...' : 'Sign In'}
          size="large"
          onPress={handleLogin}
          disabled={loading}
          style={{ marginTop: 20 }}
        />
      </View>

      {/* Forgot Password Link */}
      <View style={styles.linkContainer}>
        <Button
          title="Forgot Password?"
          variant="outline"
          size="small"
          onPress={() => router.push('/auth/forgot-password')}
        />
      </View>

      {/* Sign Up Link */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Don't have an account? </Text>
        <Button
          title="Sign Up"
          variant="outline"
          size="small"
          onPress={() => router.push('/auth/signup')}
        />
      </View>
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 32,
    alignItems: 'center',
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
  linkContainer: {
    alignItems: 'center',
    marginBottom: 24,
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
