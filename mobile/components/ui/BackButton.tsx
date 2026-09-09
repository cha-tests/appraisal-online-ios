import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { IconArrowLeft } from './icons';
import { theme } from '../../theme';

interface BackButtonProps {
  onPress: () => void;
}

/** 40px circular back button used on Confirm address / Property details /
 * Report / Broker headers. */
export function BackButton({ onPress }: BackButtonProps) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.button} activeOpacity={0.7}>
      <IconArrowLeft />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.color.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.space.lg,
  },
});
