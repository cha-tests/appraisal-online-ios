import React from 'react';
import { TextInput as RNTextInput, StyleSheet, View, Text, StyleProp, ViewStyle } from 'react-native';
import { theme } from '../../theme';

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
  return (
    <View style={[styles.container, style]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <RNTextInput
        style={[styles.input, error && styles.inputError, !editable && styles.disabled]}
        placeholder={placeholder}
        placeholderTextColor={theme.color.textFaint}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        maxLength={maxLength}
        editable={editable}
        multiline={multiline}
        numberOfLines={numberOfLines}
        autoCapitalize={autoCapitalize}
      />
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
