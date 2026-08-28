import React from "react";
import { View, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../theme/ThemeContext";

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
  scrollEnabled?: boolean;
};

export function Screen({ children, scroll = true, scrollEnabled = true }: Props) {
  const theme = useTheme();
  const { colors } = theme;

  const content = (
    <View style={{ flex: 1, paddingHorizontal: 16, paddingVertical: 16, gap: 16 }}>{children}</View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={0}>
        {scroll ? (
          <ScrollView
            style={{ flex: 1, backgroundColor: colors.bg }}
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={false}
            scrollEnabled={scrollEnabled}
          >
            {content}
          </ScrollView>
        ) : (
          <View style={{ flex: 1, backgroundColor: colors.bg }}>{content}</View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
