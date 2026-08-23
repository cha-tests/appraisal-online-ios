import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaWrapper } from '../../components/layout/SafeAreaWrapper';
import { Button } from '../../components/ui/Button';
import { TextInput } from '../../components/ui/TextInput';
import { Toggle } from '../../components/ui/Toggle';
import { Card } from '../../components/ui/Card';
import { useAuthStore } from '../../stores/auth.store';
import { authService } from '../../services/auth.service';

export default function SignupScreen() {
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  const [userType, setUserType] = useState<'consumer' | 'broker' | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!userType) {
      newErrors.userType = 'Please select account type';
    }

    if (!fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    }

    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignup = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);
      const result = await authService.signup(email, password, {
        full_name: fullName,
        user_type: userType!,
      });

      if (result.success && result.user) {
        if (result.needsEmailConfirmation) {
          router.replace({ pathname: '/auth/verify-email', params: { email } });
          return;
        }

        setUser(result.user);
        // Route based on user type
        if (userType === 'broker') {
          router.replace('/broker/onboarding');
        } else {
          router.replace('/consumer/home');
        }
      } else {
        Alert.alert('Signup Failed', result.error || 'Unable to create account');
      }
    } catch (err) {
      console.error('Signup error:', err);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!userType) {
    return (
      <SafeAreaWrapper scrollable>
        <View style={styles.header}>
          <Button
            title="← Back"
            variant="outline"
            size="small"
            onPress={() => router.back()}
            style={{ alignSelf: 'flex-start', marginBottom: 20 }}
          />
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Choose your account type</Text>
        </View>

        <View style={styles.typeSelection}>
          <Card
            variant={userType === 'consumer' ? 'elevated' : 'default'}
            style={[
              styles.typeCard,
              userType === 'consumer' && styles.typeCardSelected,
            ]}
          >
            <Button
              title="🏠 I'm a Homeowner"
              variant="outline"
              size="large"
              onPress={() => setUserType('consumer')}
            />
            <Text style={styles.typeDescription}>
              Get free AI valuations and connect with professionals
            </Text>
          </Card>

          <Card
            variant={userType === 'broker' ? 'elevated' : 'default'}
            style={[
              styles.typeCard,
              userType === 'broker' && styles.typeCardSelected,
            ]}
          >
            <Button
              title="🏢 I'm a Real Estate Pro"
              variant="outline"
              size="large"
              onPress={() => setUserType('broker')}
            />
            <Text style={styles.typeDescription}>
              Get qualified leads and grow your business
            </Text>
          </Card>
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
          onPress={() => setUserType(null)}
          style={{ alignSelf: 'flex-start', marginBottom: 16 }}
        />
        <Text style={styles.title}>Create Your Account</Text>
        <Text style={styles.subtitle}>
          {userType === 'consumer' ? 'Homeowner' : 'Real Estate Professional'} Account
        </Text>
      </View>

      {/* Form */}
      <View style={styles.form}>
        <TextInput
          placeholder="Full Name"
          value={fullName}
          onChangeText={setFullName}
          editable={!loading}
          error={errors.fullName}
        />

        <TextInput
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!loading}
          error={errors.email}
          style={{ marginTop: 12 }}
        />

        <TextInput
          placeholder="Password (min 8 characters)"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!loading}
          error={errors.password}
          style={{ marginTop: 12 }}
        />

        <TextInput
          placeholder="Confirm Password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          editable={!loading}
          error={errors.confirmPassword}
          style={{ marginTop: 12 }}
        />

        {/* Terms Agreement */}
        <Card variant="outlined" style={styles.termsCard}>
          <Text style={styles.termsText}>
            By signing up, you agree to our Terms of Service and Privacy Policy
          </Text>
        </Card>

        <Button
          title={loading ? 'Creating Account...' : 'Create Account'}
          size="large"
          onPress={handleSignup}
          disabled={loading}
          style={{ marginTop: 20 }}
        />
      </View>

      {/* Login Link */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Already have an account? </Text>
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
  typeSelection: {
    gap: 12,
  },
  typeCard: {
    padding: 0,
  },
  typeCardSelected: {
    borderColor: '#2563EB',
    borderWidth: 2,
  },
  typeDescription: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
  },
  form: {
    marginBottom: 24,
  },
  termsCard: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BFDBFE',
    marginTop: 16,
  },
  termsText: {
    fontSize: 12,
    color: '#1F2937',
    lineHeight: 18,
    textAlign: 'center',
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
