import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../stores/auth.store';

export default function SplashScreen() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated());
  const isBroker = useAuthStore((state) => state.isBroker());

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isAuthenticated) {
        if (isBroker) {
          router.push('/broker/splash');
        } else {
          router.push('/consumer/home');
        }
      } else {
        router.push('/auth/login');
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [isAuthenticated, isBroker, router]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Appraisal Online</Text>
      <Text style={styles.subtitle}>Loading...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
  },
});
