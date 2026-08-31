import React, { useRef, useCallback, useEffect } from "react";
import { View, Text, Pressable, StyleSheet, TextStyle } from "react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "../theme/ThemeContext";
import { NumericField } from "./NumericField";

type Props = {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  onIncrement: () => void;
  onDecrement: () => void;
  unit?: string;
  onUnitPress?: () => void;
  placeholder?: string;
  accessibilityLabel?: string;
  decimal?: boolean;
  onLockScroll?: (locked: boolean) => void;
};

export function QuantityControl({
  label,
  value,
  onChange,
  onIncrement,
  onDecrement,
  unit,
  onUnitPress,
  placeholder,
  accessibilityLabel,
  decimal = false,
  onLockScroll,
}: Props) {
  const theme = useTheme();
  const { colors, radii } = theme;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lock = useCallback(() => {
    onLockScroll?.(true);
  }, [onLockScroll]);

  const unlock = useCallback(() => {
    onLockScroll?.(false);
  }, [onLockScroll]);

  const clearTimers = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    unlock();
  }, [unlock]);

  const startRepeat = useCallback(
    (fn: () => void) => {
      lock();
      timeoutRef.current = setTimeout(() => {
        intervalRef.current = setInterval(() => {
          fn();
          void Haptics.selectionAsync();
        }, 150);
      }, 350);
    },
    [lock]
  );

  useEffect(() => () => clearTimers(), [clearTimers]);

  const btnStyle = {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    borderCurve: "continuous" as const,
    backgroundColor: colors.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  };

  return (
    <View style={{ gap: 6 }} accessibilityLabel={accessibilityLabel} collapsable={false}>
      <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "600" } as TextStyle}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Pressable
          onPress={() => {
            onDecrement();
            void Haptics.selectionAsync();
          }}
          onLongPress={() => startRepeat(onDecrement)}
          delayLongPress={350}
          onPressOut={clearTimers}
          accessibilityLabel={`Decrease ${label}`}
          accessibilityRole="button"
          style={({ pressed }) => [btnStyle, pressed ? { backgroundColor: colors.border } : null]}
        >
          <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: "600" } as TextStyle}>−</Text>
        </Pressable>
        <NumericField
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          fill
          decimal={decimal}
          accessibilityLabel={label}
        />
        <Pressable
          onPress={() => {
            onIncrement();
            void Haptics.selectionAsync();
          }}
          onLongPress={() => startRepeat(onIncrement)}
          delayLongPress={350}
          onPressOut={clearTimers}
          accessibilityLabel={`Increase ${label}`}
          accessibilityRole="button"
          style={({ pressed }) => [btnStyle, pressed ? { backgroundColor: colors.border } : null]}
        >
          <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: "600" } as TextStyle}>+</Text>
        </Pressable>
        {unit ? (
          onUnitPress ? (
            <Pressable
              onPress={onUnitPress}
              accessibilityRole="button"
              accessibilityLabel={`Weight unit ${unit}. Tap to switch between lbs and kg`}
              hitSlop={8}
              style={({ pressed }) => ({
                minWidth: 40,
                minHeight: 44,
                paddingHorizontal: 8,
                borderRadius: radii.pill,
                borderCurve: "continuous" as const,
                alignItems: "center" as const,
                justifyContent: "center" as const,
                backgroundColor: pressed ? colors.border : colors.surfaceRaised,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: colors.border,
              })}
            >
              <Text style={{ color: colors.accent, fontSize: 14, fontWeight: "700" } as TextStyle}>{unit}</Text>
            </Pressable>
          ) : (
            <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: "600", minWidth: 28 } as TextStyle}>{unit}</Text>
          )
        ) : null}
      </View>
    </View>
  );
}
