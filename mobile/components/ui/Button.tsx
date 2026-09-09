import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle, ActivityIndicator } from 'react-native';
import { theme } from '../../theme';

interface ButtonProps {
  onPress: () => void;
  title: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({
  onPress,
  title,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  style,
  textStyle,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      style={[styles.button, styles[variant], styles[`size_${size}`], isDisabled && styles.disabled, style]}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' ? theme.color.accent : theme.color.onAccent} />
      ) : (
        <Text style={[styles.text, styles[`text_${variant}`], styles[`text_${size}`], textStyle]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: theme.radius.full,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  // Variants — no colour left to distinguish primary/secondary/danger, so
  // fill vs. outline vs. wash is what carries the difference (see theme.ts's
  // note that state is carried by weight and ring width, not colour).
  primary: {
    backgroundColor: theme.color.accent,
  },
  secondary: {
    backgroundColor: theme.color.accentWash,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: theme.color.accent,
  },
  danger: {
    backgroundColor: theme.color.danger,
  },
  disabled: {
    opacity: 0.4,
  },
  // Sizes
  size_small: {
    paddingVertical: theme.space.sm,
    paddingHorizontal: theme.space.md,
    minHeight: theme.size.tapMin,
  },
  size_medium: {
    paddingVertical: theme.space.md,
    paddingHorizontal: theme.space.lg,
    minHeight: theme.size.control,
  },
  size_large: {
    paddingVertical: theme.space.lg,
    paddingHorizontal: theme.space.xl,
    minHeight: theme.size.cta,
  },
  // Text
  text: {
    fontFamily: theme.font.bodySemibold,
  },
  text_primary: {
    color: theme.color.onAccent,
  },
  text_secondary: {
    color: theme.color.accentInk,
  },
  text_outline: {
    color: theme.color.accent,
  },
  text_danger: {
    color: theme.color.onAccent,
  },
  text_small: {
    fontSize: theme.type.meta.fontSize,
  },
  text_medium: {
    fontSize: theme.type.label.fontSize,
  },
  text_large: {
    fontSize: theme.type.body.fontSize,
  },
});
