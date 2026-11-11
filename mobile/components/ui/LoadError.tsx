import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Button } from './Button';
import { theme } from '../../theme';

interface LoadErrorProps {
  message?: string;
  onRetry: () => void;
}

/** Shown in place of a screen's content when its initial data load fails or
 * times out (see withTimeout.ts) — replaces an indefinite loading spinner
 * with a dead end. */
export function LoadError({ message = "Couldn't load this screen.", onRetry }: LoadErrorProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>⚠️</Text>
      <Text style={styles.message}>{message}</Text>
      <Button title="Retry" variant="outline" onPress={onRetry} style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
    paddingHorizontal: 24,
  },
  icon: {
    fontSize: 40,
    marginBottom: 12,
  },
  message: {
    fontSize: 15,
    color: theme.color.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 4,
  },
  button: {
    marginTop: 16,
    minWidth: 120,
  },
});
