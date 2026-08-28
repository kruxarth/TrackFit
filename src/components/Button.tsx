import React from "react";
import { Pressable, Text, ViewStyle, TextStyle, StyleSheet } from "react-native";
import { useTheme } from "../theme/ThemeContext";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "sm";

type Props = {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  fullWidth?: boolean;
  accessibilityLabel?: string;
};

export function Button({
  title,
  onPress,
  variant = "primary",
  size = "md",
  disabled = false,
  fullWidth = false,
  accessibilityLabel,
}: Props) {
  const theme = useTheme();
  const { colors, radii } = theme;

  const height = size === "md" ? 44 : 34;

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => {
        let backgroundColor: string;

        if (disabled) {
          if (variant === "primary") {
            backgroundColor = colors.border;
          } else if (variant === "secondary") {
            backgroundColor = colors.surfaceRaised;
          } else {
            backgroundColor = "transparent";
          }
        } else if (variant === "primary") {
          backgroundColor = pressed ? colors.accentPressed : colors.accent;
        } else if (variant === "secondary") {
          backgroundColor = pressed ? colors.border : colors.surfaceRaised;
        } else if (variant === "ghost") {
          backgroundColor = pressed ? colors.surface : "transparent";
        } else {
          // danger
          backgroundColor = pressed ? colors.surface : "transparent";
        }

        const base: ViewStyle = {
          height,
          borderRadius: radii.button,
          borderCurve: "continuous",
          backgroundColor,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 16,
          alignSelf: fullWidth ? "stretch" : undefined,
          borderWidth: variant === "secondary" ? StyleSheet.hairlineWidth : 0,
          borderColor: variant === "secondary" ? colors.border : undefined,
        };
        return base;
      }}
    >
      <Text
        style={
          {
            color:
              disabled
                ? colors.textDisabled
                : variant === "primary"
                  ? colors.onAccent
                  : variant === "secondary"
                    ? colors.textPrimary
                    : variant === "ghost"
                      ? colors.accent
                      : colors.danger,
            fontSize: 15,
            fontWeight: "600",
            fontVariant: ["tabular-nums"],
          } as TextStyle
        }
      >
        {title}
      </Text>
    </Pressable>
  );
}
