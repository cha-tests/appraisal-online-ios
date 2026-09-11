import React, { useState } from 'react';
import { TextInput as RNTextInput, StyleSheet, View, Text, StyleProp, ViewStyle, TouchableOpacity } from 'react-native';
import { theme } from '../../theme';
import { IconEye, IconEyeOff } from './icons';

interface TextInputProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad' | 'decimal-pad' | 'number-pad';
  secureTextEntry?: boolean;
  maxLength?: number;
  editable?: boolean;
  style?: StyleProp<ViewStyle>;
  multiline?: boolean;
  numberOfLines?: number;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}

export function TextInput({
  label,
  placeholder,
  value,
  onChangeText,
  error,
  keyboardType = 'default',
  secureTextEntry = false,
  maxLength,
  editable = true,
  style,
  multiline = false,
  numberOfLines = 1,
  autoCapitalize,
}: TextInputProps) {
  // Only a password-type field (secureTextEntry) ever gets the show/hide
  // toggle; starts masked regardless, same as before this existed.
  const [revealed, setRevealed] = useState(false);

  return (
    <View style={[styles.container, style]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.inputWrapper}>
        <RNTextInput
          style={[
            styles.input,
            secureTextEntry && styles.inputWithToggle,
            error && styles.inputError,
            !editable && styles.disabled,
          ]}
          placeholder={placeholder}
          placeholderTextColor={theme.color.textFaint}
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry && !revealed}
          maxLength={maxLength}
          editable={editable}
          multiline={multiline}
          numberOfLines={numberOfLines}
          autoCapitalize={autoCapitalize}
        />
        {secureTextEntry && (
          <TouchableOpacity
            style={styles.toggleButton}
            onPress={() => setRevealed((prev) => !prev)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
          >
            {revealed ? (
              <IconEye size={20} color={theme.color.textMuted} />
            ) : (
              <IconEyeOff size={20} color={theme.color.textMuted} />
            )}
          </TouchableOpacity>
        )}
      </View>
      {!!error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.space.lg,
  },
  label: {
    ...theme.type.label,
    color: theme.color.text,
    marginBottom: theme.space.xs + 2,
  },
  inputWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.space.md + 2,
    paddingVertical: theme.space.md,
    minHeight: theme.size.control,
    fontFamily: theme.font.body,
    fontSize: theme.type.body.fontSize,
    color: theme.color.text,
    backgroundColor: theme.color.surface,
  },
  inputWithToggle: {
    paddingRight: theme.space.md + 2 + 28,
  },
  toggleButton: {
    position: 'absolute',
    right: theme.space.md + 2,
  },
  inputError: {
    borderColor: theme.color.danger,
  },
  disabled: {
    backgroundColor: theme.color.accentWash,
    color: theme.color.textFaint,
  },
  errorText: {
    ...theme.type.caption,
    color: theme.color.danger,
    marginTop: theme.space.xs,
  },
});
