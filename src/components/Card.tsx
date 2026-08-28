import React from "react";
import { Pressable, View, StyleSheet, ViewStyle } from "react-native";
import { useTheme } from "../theme/ThemeContext";

type Props = {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  accessibilityLabel?: string;
};

export function Card({ children, onPress, style, accessibilityLabel }: Props) {
  const theme = useTheme();
  const { colors, radii } = theme;

  const baseStyle: ViewStyle = {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  };

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [
          baseStyle,
          pressed ? { opacity: 0.9 } : null,
          style,
          theme.isDark ? null : { elevation: 2, shadowColor: "black", shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View
      style={[
        baseStyle,
        style,
        theme.isDark ? null : { elevation: 2, shadowColor: "black", shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
      ]}
    >
      {children}
    </View>
  );
}
