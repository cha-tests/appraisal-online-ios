import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { theme, card } from '../../theme';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: number;
  variant?: 'default' | 'elevated' | 'outlined';
}

export function Card({ children, style, padding, variant = 'default' }: CardProps) {
  const paddingStyle = padding !== undefined
    ? { padding }
    : { paddingVertical: theme.space.lg, paddingHorizontal: theme.space.lg + 2 };

  return (
    <View style={[styles.card, styles[variant], paddingStyle, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: theme.radius.lg,
    backgroundColor: theme.color.surface,
  },
  // Structure is carried by a hairline edge, not a shadow — see theme.ts's
  // "Structure is carried by lines" note. `elevated` is the one exception:
  // the search-suggestions dropdown, which floats over content.
  default: {
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  elevated: {
    ...card.floating,
  },
  outlined: {
    borderWidth: 1,
    borderColor: theme.color.border,
  },
});
