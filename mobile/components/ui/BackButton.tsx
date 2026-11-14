import React from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { IconArrowLeft } from './icons';
import { theme } from '../../theme';

interface BackButtonProps {
  onPress: () => void;
  /** Override the default stacked-layout spacing (marginBottom) — pass this
   * when the button sits inline in a row next to a title instead of above
   * one, e.g. { marginBottom: 0, marginRight: theme.space.md }. */
  style?: ViewStyle;
}

/** Bare back arrow at the top-left of a screen, used on every screen with a
 * back action. No circle/border — just the glyph. */
export function BackButton({ onPress, style }: BackButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.button, style]}
      activeOpacity={0.6}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
    >
      <IconArrowLeft />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'flex-start',
    marginBottom: theme.space.lg,
  },
});
