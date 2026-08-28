import React, { useRef, useCallback, useEffect } from "react";
import { View, Text, Pressable, StyleSheet, TextStyle } from "react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "../theme/ThemeContext";

type Props = {
  value: number;
  onIncrement: () => void;
  onDecrement: () => void;
  accessibilityLabel?: string;
};

export function Stepper({ value, onIncrement, onDecrement, accessibilityLabel }: Props) {
  const theme = useTheme();
  const { colors, radii } = theme;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const startLongPress = useCallback(
    (fn: () => void) => {
      fn();
      void Haptics.selectionAsync();
      timeoutRef.current = setTimeout(() => {
        intervalRef.current = setInterval(() => {
          fn();
          void Haptics.selectionAsync();
        }, 150);
      }, 350);
    },
    []
  );

  const handlePressInIncrement = useCallback(() => {
    startLongPress(() => {
      onIncrement();
    });
  }, [onIncrement, startLongPress]);

  const handlePressInDecrement = useCallback(() => {
    startLongPress(() => {
      onDecrement();
    });
  }, [onDecrement, startLongPress]);

  const handlePressOut = useCallback(() => {
    clearTimers();
  }, [clearTimers]);

  useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  const btnStyle = {
    width: 34,
    height: 34,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  };

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }} accessibilityLabel={accessibilityLabel}>
      <Pressable
        onPressIn={handlePressInDecrement}
        onPressOut={handlePressOut}
        accessibilityLabel="Decrement"
        accessibilityRole="button"
        style={({ pressed }) => [btnStyle, pressed ? { backgroundColor: colors.border } : null]}
      >
        <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: "600" } as TextStyle}>−</Text>
      </Pressable>
      <View
        style={{
          minWidth: 48,
          height: 34,
          borderRadius: radii.input,
          backgroundColor: colors.surfaceRaised,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 8,
        }}
      >
        <Text
          style={
            {
              color: colors.textPrimary,
              fontSize: 15,
              fontWeight: "600",
              fontVariant: ["tabular-nums"],
            } as TextStyle
          }
        >
          {value}
        </Text>
      </View>
      <Pressable
        onPressIn={handlePressInIncrement}
        onPressOut={handlePressOut}
        accessibilityLabel="Increment"
        accessibilityRole="button"
        style={({ pressed }) => [btnStyle, pressed ? { backgroundColor: colors.border } : null]}
      >
        <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: "600" } as TextStyle}>+</Text>
      </Pressable>
    </View>
  );
}
