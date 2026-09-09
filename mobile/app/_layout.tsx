import 'react-native-url-polyfill/auto';
import '../polyfills/alert';
import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import { Archivo_400Regular, Archivo_500Medium, Archivo_600SemiBold, Archivo_700Bold } from '@expo-google-fonts/archivo';
import { BodoniModa_600SemiBold } from '@expo-google-fonts/bodoni-moda';
import { initStripe } from '../lib/stripe';
import * as SplashScreen from 'expo-splash-screen';
import { supabase, getCurrentUser } from '../services/supabase';
import { useAuthStore } from '../stores/auth.store';
import { brokerService } from '../services/broker.service';

// Initialize the Stripe SDK. lib/stripe is platform-split, so this is a no-op
// on web (where the SDK has no implementation) without the web bundle ever
// resolving the native module.
const publishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;
if (publishableKey) {
  try {
    initStripe({
      publishableKey,
      merchantIdentifier: 'merchant.com.appraisal.online', // Required on iOS
    });
  } catch (error) {
    console.warn('Failed to initialize Stripe SDK:', error);
    // Non-fatal: the app still runs, and checkout surfaces the failure.
  }
}

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const setUser = useAuthStore((state) => state.setUser);
  const setBrokerProfile = useAuthStore((state) => state.setBrokerProfile);

  // theme.ts's `font` object names these two faces by these exact export
  // names — the monochrome redesign's Archivo (body/heading) + Bodoni Moda
  // (hero values only). Splash stays up (see prepareApp's finally below)
  // until both this AND the auth check are done, so no screen can flash
  // system-font text before these are ready.
  const [fontsLoaded] = useFonts({
    Archivo_400Regular,
    Archivo_500Medium,
    Archivo_600SemiBold,
    Archivo_700Bold,
    BodoniModa_600SemiBold,
  });

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
      }
    }

    prepareApp();
  }, []);

  useEffect(() => {
    if (isReady && fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [isReady, fontsLoaded]);

  if (!isReady || !fontsLoaded) {
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
