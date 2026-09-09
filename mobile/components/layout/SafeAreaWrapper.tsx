import React from 'react';
import { View, ScrollView, StyleSheet, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
}

export function SafeAreaWrapper({
  children,
  scrollable = false,
  style,
  contentContainerStyle,
  showBottomPadding = true,
  scrollEnabled = true,
}: SafeAreaWrapperProps) {
  const insets = useSafeAreaInsets();

  const containerStyle = [
    styles.container,
    {
      paddingTop: insets.top || 16,
      paddingLeft: insets.left || 16,
      paddingRight: insets.right || 16,
      paddingBottom: showBottomPadding ? (insets.bottom || 16) : 0,
    },
    style,
  ];

  if (scrollable) {
    return (
      <ScrollView
        style={containerStyle}
        contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={scrollEnabled}
      >
        {children}
      </ScrollView>
    );
  }

  return <View style={containerStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    flexGrow: 1,
  },
});
