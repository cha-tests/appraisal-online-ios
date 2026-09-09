import React from 'react';
import { Stack } from 'expo-router';
import { RequireUserType } from '../../components/auth/RequireUserType';

export default function ConsumerLayout() {
  return (
    <RequireUserType type="consumer" allowGuest>
      <Stack
        screenOptions={{
          headerShown: false,
          animationEnabled: true,
          gestureEnabled: true,
        }}
      >
        <Stack.Screen name="home" />
        <Stack.Screen name="confirmation" />
        <Stack.Screen name="property-details" />
        <Stack.Screen name="loading" />
        <Stack.Screen name="report-view" />
        <Stack.Screen name="broker-optins" />
        <Stack.Screen name="account" />
      </Stack>
    </RequireUserType>
  );
}
