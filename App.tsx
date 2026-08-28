import React, { useState, useEffect } from "react";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider, useTheme } from "./src/theme/ThemeContext";
import { getDatabase } from "./src/db/database";
import { useSettingsStore } from "./src/stores/settingsStore";
import { useWorkoutStore } from "./src/stores/workoutStore";
import { RootNavigator } from "./src/navigation/RootNavigator";
import * as pedometer from "./src/services/pedometer";

function AppGate() {
  const theme = useTheme();
  const hydrateSettings = useSettingsStore((s) => s.hydrate);
  const hydratedSettings = useSettingsStore((s) => s.hydrated);
  const hydrateWorkout = useWorkoutStore((s) => s.hydrate);
  const hydratedWorkout = useWorkoutStore((s) => s.hydrated);
  const stepsEnabled = useSettingsStore((s) => s.stepsEnabled);
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function init(attempt = 0) {
      try {
        await getDatabase();
        await hydrateSettings();
        await hydrateWorkout();
        if (!cancelled) setDbReady(true);
      } catch (e) {
        console.error("Init failed", e);
        if (!cancelled && attempt < 8) {
          setTimeout(() => {
            if (!cancelled) void init(attempt + 1);
          }, 300 * 2 ** Math.min(attempt, 4));
        }
      }
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, [hydrateSettings, hydrateWorkout]);

  useEffect(() => {
    if (!dbReady || !hydratedSettings) return;
    if (stepsEnabled) {
      void pedometer.startWatching().catch(() => {});
    } else {
      pedometer.stopWatching();
    }
  }, [dbReady, hydratedSettings, stepsEnabled]);

  if (!dbReady || !hydratedSettings || !hydratedWorkout) {
    return <View style={{ flex: 1, backgroundColor: theme.colors.bg }} />;
  }
  return <RootNavigator />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppGate />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
