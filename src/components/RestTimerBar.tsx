import React, { useEffect, useState } from "react";
import { View, Text, Pressable, TextStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useTheme } from "../theme/ThemeContext";

type Props = {
  endsAt: number;
  onAdd15: () => void;
  onSkip: () => void;
  onDone: () => void;
};

function formatRemaining(ms: number): string {
  const sec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function RestTimerBar({ endsAt, onAdd15, onSkip, onDone }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [remaining, setRemaining] = useState(() => endsAt - Date.now());
  const [doneFired, setDoneFired] = useState(false);

  useEffect(() => {
    const tick = () => {
      const diff = endsAt - Date.now();
      setRemaining(diff);
      if (diff <= 0 && !doneFired) {
        setDoneFired(true);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onDone();
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [endsAt, doneFired, onDone]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDoneFired(false);
    setRemaining(endsAt - Date.now());
  }, [endsAt]);

  if (remaining <= 0) return null;

  return (
    <View
      style={{
        position: "absolute",
        bottom: 16 + insets.bottom,
        left: 16,
        right: 16,
        backgroundColor: theme.colors.accent,
        borderRadius: theme.radii.card,
        borderCurve: "continuous",
        paddingHorizontal: 16,
        paddingVertical: 14,
        gap: 10,
        elevation: 6,
        shadowColor: "black",
        shadowOpacity: 0.18,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 },
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text style={{ color: theme.colors.onAccent, fontSize: 11, fontWeight: "700", letterSpacing: 0.6 } as TextStyle}>REST BETWEEN SETS</Text>
          <Text style={{ color: theme.colors.onAccent, fontSize: 28, fontWeight: "700", fontVariant: ["tabular-nums"] as TextStyle["fontVariant"] } as TextStyle}>
            {formatRemaining(remaining)}
          </Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            onPress={onAdd15}
            accessibilityLabel="Add 15 seconds of rest"
            style={{
              paddingHorizontal: 12,
              paddingVertical: 10,
              minHeight: 44,
              justifyContent: "center",
              borderRadius: theme.radii.pill,
              borderCurve: "continuous",
              backgroundColor: "rgba(0,0,0,0.18)",
            }}
          >
            <Text style={{ color: theme.colors.onAccent, fontSize: 13, fontWeight: "700" } as TextStyle}>+15s</Text>
          </Pressable>
          <Pressable
            onPress={onSkip}
            accessibilityLabel="Skip rest"
            style={{
              paddingHorizontal: 14,
              paddingVertical: 10,
              minHeight: 44,
              justifyContent: "center",
              borderRadius: theme.radii.pill,
              borderCurve: "continuous",
              backgroundColor: theme.colors.bg,
            }}
          >
            <Text style={{ color: theme.colors.textPrimary, fontSize: 13, fontWeight: "700" } as TextStyle}>Skip rest</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
