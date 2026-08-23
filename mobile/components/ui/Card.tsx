import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padding?: number;
  variant?: 'default' | 'elevated' | 'outlined';
}

export function Card({ children, style, padding = 16, variant = 'default' }: CardProps) {
  return (
    <View style={[styles.card, styles[variant], { padding }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  default: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  elevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  outlined: {
    borderWidth: 2,
    borderColor: '#D1D5DB',
  },
});
