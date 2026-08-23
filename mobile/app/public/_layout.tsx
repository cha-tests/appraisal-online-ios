import React from 'react';
import { Stack } from 'expo-router';

export default function PublicLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animationEnabled: true,
      }}
    >
      <Stack.Screen name="demo" />
      <Stack.Screen name="founders" />
      <Stack.Screen name="how-we-make-money" />
    </Stack>
  );
}
