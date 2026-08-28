import React from "react";
import { View, Pressable, Text, StyleSheet, TextStyle } from "react-native";
import { useTheme } from "../theme/ThemeContext";

type Props<T extends string> = {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  accessibilityLabel?: string;
};

export function SegmentedControl<T extends string>({ options, value, onChange, accessibilityLabel }: Props<T>) {
  const theme = useTheme();
  const { colors, radii } = theme;

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={{
        flexDirection: "row",
        backgroundColor: colors.surfaceRaised,
        borderRadius: radii.pill,
        padding: 3,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
        gap: 2,
      }}
    >
      {options.map((opt) => {
        const selected = opt === value;
        return (
          <Pressable
            key={opt}
            onPress={() => onChange(opt)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={{
              flex: 1,
              paddingVertical: 7,
              paddingHorizontal: 6,
              borderRadius: radii.pill,
              backgroundColor: selected ? colors.accent : "transparent",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              numberOfLines={1}
              style={
                {
                  color: selected ? colors.onAccent : colors.textSecondary,
                  fontSize: 13,
                  fontWeight: selected ? "700" : "500",
                  fontVariant: ["tabular-nums"],
                } as TextStyle
              }
            >
              {opt}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
