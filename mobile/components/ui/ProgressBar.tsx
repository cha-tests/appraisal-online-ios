import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { theme } from '../../theme';

interface ProgressBarProps {
  /** 0-100. */
  progress: number;
  /** e.g. "1 of 3". */
  label?: string;
}

/** Ink fill on a grey track, 0.5s ease transition — used on Confirm address,
 * Property details and Generating to show where the user is in the flow. */
export function ProgressBar({ progress, label }: ProgressBarProps) {
  const widthAnim = useRef(new Animated.Value(progress)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: progress,
      duration: theme.duration.base,
      useNativeDriver: false,
    }).start();
  }, [progress, widthAnim]);

  return (
    <View style={styles.row}>
      <View style={styles.track}>
        <Animated.View
          style={[
            styles.fill,
            { width: widthAnim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) },
          ]}
        />
      </View>
      {!!label && <Text style={styles.label}>{label}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.md,
    marginBottom: theme.space.xl,
  },
  track: {
    flex: 1,
    height: theme.size.bar,
    borderRadius: theme.radius.full,
    backgroundColor: theme.color.track,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: theme.radius.full,
    backgroundColor: theme.color.accent,
  },
  label: {
    ...theme.type.caption,
    color: theme.color.textMuted,
  },
});
