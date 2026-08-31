import React, { useEffect, useRef, useState } from "react";
import { View, ScrollView, KeyboardAvoidingView, Platform, Keyboard } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../theme/ThemeContext";

export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvt, (e) => {
      setHeight(e.endCoordinates.height);
    });
    const hide = Keyboard.addListener(hideEvt, () => {
      setHeight(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height;
}

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
  scrollEnabled?: boolean;
  /** When this becomes true, scroll to the end so a newly focused bottom field stays visible. */
  scrollToEndKey?: boolean;
};

export function Screen({ children, scroll = true, scrollEnabled = true, scrollToEndKey }: Props) {
  const theme = useTheme();
  const { colors } = theme;
  const scrollRef = useRef<ScrollView>(null);
  const keyboardHeight = useKeyboardHeight();

  useEffect(() => {
    if (!scrollToEndKey) return;
    const t = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 80);
    return () => clearTimeout(t);
  }, [scrollToEndKey, keyboardHeight]);

  const content = (
    <View style={{ flex: 1, paddingHorizontal: 16, paddingVertical: 16, gap: 16 }}>{children}</View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={0}>
        {scroll ? (
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1, backgroundColor: colors.bg }}
            contentContainerStyle={{ flexGrow: 1, paddingBottom: scrollToEndKey ? keyboardHeight : 0 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
            automaticallyAdjustKeyboardInsets
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
