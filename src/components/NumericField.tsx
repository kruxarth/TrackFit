import React, { useState, useEffect } from "react";
import { TextInput, StyleSheet, TextStyle } from "react-native";
import { useTheme } from "../theme/ThemeContext";

type Props = {
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  accessibilityLabel?: string;
  fill?: boolean;
  decimal?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
};

export function NumericField({
  value,
  onChange,
  placeholder,
  accessibilityLabel,
  fill = false,
  decimal = false,
  onFocus,
  onBlur,
}: Props) {
  const theme = useTheme();
  const { colors, radii } = theme;
  const [text, setText] = useState(value !== null && value !== undefined ? String(value) : "");
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setText(value !== null && value !== undefined ? String(value) : "");
    }
  }, [value, focused]);

  const handleChangeText = (t: string) => {
    const filtered = decimal ? t.replace(/[^0-9.]/g, "") : t.replace(/[^0-9]/g, "");
    setText(filtered);
    if (filtered === "" || filtered === ".") {
      onChange(null);
      return;
    }
    const num = Number(filtered);
    if (!Number.isNaN(num)) {
      onChange(num);
    }
  };

  const handleBlur = () => {
    setFocused(false);
    onBlur?.();
    if (text === "" || text === ".") {
      onChange(null);
      setText("");
    } else {
      const num = Number(text);
      if (!Number.isNaN(num)) {
        setText(String(num));
      }
    }
  };

  return (
    <TextInput
      value={text}
      onChangeText={handleChangeText}
      onFocus={() => {
        setFocused(true);
        onFocus?.();
      }}
      onBlur={handleBlur}
      placeholder={placeholder}
      placeholderTextColor={colors.textDisabled}
      keyboardType={decimal ? "decimal-pad" : "number-pad"}
      inputMode={decimal ? "decimal" : "numeric"}
      scrollEnabled={false}
      multiline={false}
      caretHidden={false}
      showSoftInputOnFocus
      accessibilityLabel={accessibilityLabel}
      underlineColorAndroid="transparent"
      style={
        {
          minWidth: fill ? 0 : 48,
          flex: fill ? 1 : undefined,
          height: 44,
          borderRadius: radii.input,
          backgroundColor: colors.surfaceRaised,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: focused ? colors.accent : colors.border,
          color: colors.textPrimary,
          fontSize: 18,
          fontWeight: "600",
          textAlign: "center",
          textAlignVertical: "center",
          paddingHorizontal: 8,
          paddingVertical: 0,
          includeFontPadding: false,
          fontVariant: ["tabular-nums"],
        } as TextStyle
      }
    />
  );
}
