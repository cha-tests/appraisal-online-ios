import React from 'react';
import { View, ScrollView, StyleSheet, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../theme';
import { BackButton } from '../ui/BackButton';

interface SafeAreaWrapperProps {
  children: React.ReactNode;
  scrollable?: boolean;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
  showBottomPadding?: boolean;
  // Lets a screen temporarily disable the outer scroll — e.g. while a
  // dropdown nested inside it needs sole ownership of the touch gesture.
  // position:absolute on the nested content only changes where it's drawn,
  // not React Native's touch-responder hierarchy, so on a real device the
  // outer ScrollView can still claim the gesture before the inner one even
  // when the inner list is visually floating on top of everything else.
  scrollEnabled?: boolean;
  // Renders a back arrow pinned to the top-left corner, outside the
  // scrollable content, so it stays on screen instead of scrolling away
  // with the rest of the page.
  onBackPress?: () => void;
}

// How much vertical room the floating back button needs reserved above the
// content, so the first line of a screen's own header never renders
// underneath it.
const BACK_BUTTON_SPACE = theme.size.tapMin;

export function SafeAreaWrapper({
  children,
  scrollable = false,
  style,
  contentContainerStyle,
  showBottomPadding = true,
  scrollEnabled = true,
  onBackPress,
}: SafeAreaWrapperProps) {
  const insets = useSafeAreaInsets();

  const topInset = insets.top || 16;
  const leftInset = insets.left || 16;

  const containerStyle = [
    styles.container,
    {
      paddingTop: onBackPress && !scrollable ? topInset + BACK_BUTTON_SPACE : topInset,
      paddingLeft: leftInset,
      paddingRight: insets.right || 16,
      paddingBottom: showBottomPadding ? (insets.bottom || 16) : 0,
    },
    style,
  ];

  const content = scrollable ? (
    <ScrollView
      style={containerStyle}
      contentContainerStyle={[
        styles.scrollContent,
        onBackPress ? { paddingTop: BACK_BUTTON_SPACE } : null,
        contentContainerStyle,
      ]}
      showsVerticalScrollIndicator={false}
      scrollEnabled={scrollEnabled}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={containerStyle}>{children}</View>
  );

  if (!onBackPress) {
    return content;
  }

  return (
    <View style={styles.container}>
      {content}
      <BackButton
        onPress={onBackPress}
        style={{ position: 'absolute', top: topInset, left: leftInset, marginBottom: 0 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.color.bg,
  },
  scrollContent: {
    flexGrow: 1,
  },
});
