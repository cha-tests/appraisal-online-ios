import React from 'react';
import { Stack } from 'expo-router';

export default function BrokerLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animationEnabled: true,
        gestureEnabled: true,
      }}
    >
      <Stack.Screen name="splash" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="value-reveal" />
      <Stack.Screen name="rating-prompt" />
      <Stack.Screen name="paywall" />
      <Stack.Screen name="checkout" />
      <Stack.Screen name="welcome" />
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="lead-inbox" />
      <Stack.Screen name="lead-detail" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="refund-request" />
    </Stack>
  );
}
