import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { supabase, getCurrentUser } from '../services/supabase';
import { useAuthStore } from '../stores/auth.store';
import { brokerService } from '../services/broker.service';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const setUser = useAuthStore((state) => state.setUser);
  const setBrokerProfile = useAuthStore((state) => state.setBrokerProfile);

  useEffect(() => {
    async function prepareApp() {
      try {
        // Check if user is already authenticated
        const user = await getCurrentUser();

        if (user) {
          // Fetch user profile from public schema
          const { data: userData } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single();

          if (userData) {
            setUser(userData);

            // If broker, fetch broker profile
            if (userData.user_type === 'broker') {
              const { profile } = await brokerService.getProfile(user.id);
              if (profile) {
                setBrokerProfile(profile);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error preparing app:', error);
      } finally {
        setIsReady(true);
        await SplashScreen.hideAsync();
      }
    }

    prepareApp();
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animationEnabled: true,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="auth" />
      <Stack.Screen name="consumer" />
      <Stack.Screen name="broker" />
      <Stack.Screen name="public" />
    </Stack>
  );
}
