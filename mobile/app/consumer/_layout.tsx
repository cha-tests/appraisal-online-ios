import React from 'react';
import { Stack } from 'expo-router';

export default function ConsumerLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animationEnabled: true,
        gestureEnabled: true,
      }}
    >
      <Stack.Screen name="home" />
      <Stack.Screen name="address-entry" />
      <Stack.Screen name="property-details" />
      <Stack.Screen name="loading" />
      <Stack.Screen name="report-view" />
      <Stack.Screen name="broker-optins" />
      <Stack.Screen name="confirmation" />
      <Stack.Screen name="account" />
    </Stack>
  );
}
