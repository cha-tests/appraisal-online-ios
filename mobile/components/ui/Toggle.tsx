import React from 'react';
import { TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { theme } from '../../theme';

interface ToggleProps {
  value: boolean;
  onToggle: (value: boolean) => void;
}

// 52 x 32 track, 26px knob, 20px travel, 0.2s transition — matches the
// design brief's broker opt-in toggle spec exactly.
const TRACK_WIDTH = 52;
const TRACK_HEIGHT = 32;
const KNOB_SIZE = 26;
const TRAVEL = 20;
const INSET = (TRACK_HEIGHT - KNOB_SIZE) / 2;

export function Toggle({ value, onToggle }: ToggleProps) {
  const animatedValue = React.useRef(new Animated.Value(value ? 1 : 0)).current;

  React.useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: value ? 1 : 0,
      duration: theme.duration.fast,
      useNativeDriver: false,
    }).start();
  }, [value, animatedValue]);

  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [INSET, INSET + TRAVEL],
  });

  // No colour to carry the on/off state with — the track border switches
  // between theme.color.track and theme.color.accent instead (same
  // "weight and ring width, not fill" rule as the pill selectors).
  const borderColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.color.track, theme.color.accent],
  });
  const backgroundColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['transparent', theme.color.accent],
  });
  const thumbColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.color.textFaint, theme.color.onAccent],
  });

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => onToggle(!value)}
      style={styles.container}
    >
      <Animated.View style={[styles.background, { borderColor, backgroundColor }]}>
        <Animated.View style={[styles.thumb, { backgroundColor: thumbColor, transform: [{ translateX }] }]} />
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: theme.space.xs,
  },
  background: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: theme.radius.full,
    borderWidth: 2,
    justifyContent: 'center',
  },
  thumb: {
    position: 'absolute',
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: KNOB_SIZE / 2,
  },
});
