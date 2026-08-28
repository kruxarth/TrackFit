import React from "react";
import { Modal, Pressable, View, Text, StyleSheet, TextStyle } from "react-native";
import { useTheme } from "../theme/ThemeContext";
import { Button } from "./Button";

export type AppModalAction = {
  title: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  onPress: () => void;
};

type Props = {
  visible: boolean;
  title: string;
  message?: string;
  onClose: () => void;
  actions: AppModalAction[];
};

export function AppModal({ visible, title, message, onClose, actions }: Props) {
  const theme = useTheme();
  const { colors, radii } = theme;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
        <Pressable
          accessibilityLabel="Dismiss"
          onPress={onClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.72)" }]}
        />
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: radii.card,
            borderCurve: "continuous",
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
            padding: 20,
            gap: 16,
            elevation: 8,
            zIndex: 1,
          }}
        >
          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.textPrimary, fontSize: theme.typography.heading.fontSize, fontWeight: "600" } as TextStyle}>{title}</Text>
            {message ? <Text style={{ color: colors.textSecondary, fontSize: 15, lineHeight: 22 } as TextStyle}>{message}</Text> : null}
          </View>
          <View style={{ gap: 8 }}>
            {actions.map((action) => (
              <Button key={action.title} title={action.title} variant={action.variant ?? "primary"} fullWidth onPress={action.onPress} />
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}
