import React from "react";
import { View, Text, TextStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";
import { Button } from "./Button";

type Props = {
  icon?: keyof typeof Ionicons.glyphMap;
  heading: string;
  caption?: string;
  buttonTitle?: string;
  onButtonPress?: () => void;
};

export function EmptyState({ icon = "barbell-outline", heading, caption, buttonTitle, onButtonPress }: Props) {
  const theme = useTheme();
  const { colors, typography } = theme;

  return (
    <View style={{ alignItems: "center", justifyContent: "center", padding: 24, gap: 12 }}>
      <Ionicons name={icon} size={48} color={colors.textDisabled} />
      <Text
        style={
          {
            color: colors.textPrimary,
            fontSize: typography.heading.fontSize,
            fontWeight: typography.heading.fontWeight,
            textAlign: "center",
          } as TextStyle
        }
      >
        {heading}
      </Text>
      {caption ? (
        <Text
          style={
            {
              color: colors.textSecondary,
              fontSize: typography.caption.fontSize,
              fontWeight: typography.caption.fontWeight,
              textAlign: "center",
            } as TextStyle
          }
        >
          {caption}
        </Text>
      ) : null}
      {buttonTitle && onButtonPress ? (
        <View style={{ marginTop: 8 }}>
          <Button title={buttonTitle} onPress={onButtonPress} variant="primary" size="md" />
        </View>
      ) : null}
    </View>
  );
}
