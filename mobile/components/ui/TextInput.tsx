import React from 'react';
import { TextInput as RNTextInput, StyleSheet, View, Text, ViewStyle } from 'react-native';

interface TextInputProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad' | 'decimal-pad';
  secureTextEntry?: boolean;
  maxLength?: number;
  editable?: boolean;
  style?: ViewStyle;
  multiline?: boolean;
  numberOfLines?: number;
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
}: TextInputProps) {
  return (
    <View style={[styles.container, style]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <RNTextInput
        style={[styles.input, error && styles.inputError, !editable && styles.disabled]}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        maxLength={maxLength}
        editable={editable}
        multiline={multiline}
        numberOfLines={numberOfLines}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#1F2937',
    backgroundColor: '#FFFFFF',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  disabled: {
    backgroundColor: '#F3F4F6',
    color: '#9CA3AF',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 4,
  },
});
