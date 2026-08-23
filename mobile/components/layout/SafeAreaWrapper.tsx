import React from 'react';
import { View, ScrollView, StyleSheet, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface SafeAreaWrapperProps {
  children: React.ReactNode;
  scrollable?: boolean;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
  showBottomPadding?: boolean;
}

export function SafeAreaWrapper({
  children,
  scrollable = false,
  style,
  contentContainerStyle,
  showBottomPadding = true,
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
