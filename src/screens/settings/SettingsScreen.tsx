import React from "react";
import { View, Text, Switch, Alert, TextStyle } from "react-native";
import Constants from "expo-constants";
import { Screen } from "../../components/Screen";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { SegmentedControl } from "../../components/SegmentedControl";
import { Stepper } from "../../components/Stepper";
import { useTheme } from "../../theme/ThemeContext";
import { useSettingsStore, type ThemePreference } from "../../stores/settingsStore";
import * as csvExport from "../../services/csvExport";
import * as backup from "../../services/backup";

export function SettingsScreen() {
  const theme = useTheme();
  const unit = useSettingsStore((s) => s.unit);
  const setUnit = useSettingsStore((s) => s.setUnit);
  const restEnabled = useSettingsStore((s) => s.restTimerEnabled);
  const setRestEnabled = useSettingsStore((s) => s.setRestTimerEnabled);
  const restSeconds = useSettingsStore((s) => s.restTimerSeconds);
  const setRestSeconds = useSettingsStore((s) => s.setRestTimerSeconds);
  const themePreference = useSettingsStore((s) => s.themePreference);
  const setThemePreference = useSettingsStore((s) => s.setThemePreference);

  const themeLabel = themePreference === "light" ? "Light" : themePreference === "dark" ? "Dark" : "System";
  const handleThemeChange = (label: "System" | "Light" | "Dark") => {
    const next: ThemePreference = label === "Light" ? "light" : label === "Dark" ? "dark" : "system";
    void setThemePreference(next);
  };

  const handleExportCsv = async () => {
    try {
      await csvExport.exportAndShareAll();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert("Export failed", msg);
    }
  };

  const handleBackup = async () => {
    try {
      await backup.backupAndShare();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert("Backup failed", msg);
    }
  };

  const handleRestore = () => {
    Alert.alert(
      "Restore from backup?",
      "This will replace ALL current data with the backup file. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Restore",
          style: "destructive",
          onPress: async () => {
            const res = await backup.pickAndRestore();
            if (res.success) {
              Alert.alert("Restore complete", "Data has been restored.");
            } else if (res.error !== "Canceled") {
              Alert.alert("Restore failed", res.error ?? "Unknown error");
            }
          },
        },
      ]
    );
  };

  return (
    <Screen>
      <Card style={{ gap: 12 }}>
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.heading.fontSize, fontWeight: "600" } as TextStyle}>Appearance</Text>
        <SegmentedControl options={["System", "Light", "Dark"] as const} value={themeLabel} onChange={handleThemeChange} />
      </Card>

      <Card style={{ gap: 12 }}>
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.heading.fontSize, fontWeight: "600" } as TextStyle}>Units</Text>
        <SegmentedControl options={["kg", "lbs"] as const} value={unit} onChange={setUnit} />
      </Card>

      <Card style={{ gap: 12 }}>
        <Text style={{ color: theme.colors.textSecondary, fontSize: 13 } as TextStyle}>
          After you mark a set done, a countdown shows how long to rest before the next set. On by default — turn it off if you time rest yourself.
        </Text>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.heading.fontSize, fontWeight: "600" } as TextStyle}>Rest timer</Text>
          <Switch
            value={restEnabled}
            onValueChange={setRestEnabled}
            trackColor={{ true: theme.colors.accent, false: theme.colors.border }}
            thumbColor={theme.colors.surface}
            accessibilityLabel="Enable rest timer"
          />
        </View>
        {restEnabled ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <Text style={{ color: theme.colors.textSecondary } as TextStyle}>Default seconds</Text>
            <Stepper
              value={restSeconds}
              onIncrement={() => setRestSeconds(Math.min(600, restSeconds + 15))}
              onDecrement={() => setRestSeconds(Math.max(15, restSeconds - 15))}
            />
            <Text style={{ color: theme.colors.textSecondary, fontVariant: ["tabular-nums"] as TextStyle["fontVariant"] } as TextStyle}>{restSeconds}s</Text>
          </View>
        ) : null}
      </Card>

      <Card style={{ gap: 12 }}>
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.heading.fontSize, fontWeight: "600" } as TextStyle}>Data</Text>
        <Button title="Export CSV" variant="secondary" onPress={handleExportCsv} />
        <Button title="Back up data (JSON)" variant="secondary" onPress={handleBackup} />
        <Button title="Restore from backup" variant="danger" onPress={handleRestore} />
      </Card>

      <Card style={{ gap: 8 }}>
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.heading.fontSize, fontWeight: "600" } as TextStyle}>About</Text>
        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize } as TextStyle}>TrackFit v{Constants.expoConfig?.version ?? "0.0.1"}</Text>
        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize } as TextStyle}>MIT License — Copyright (c) 2026 TrackFit contributors</Text>
        <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize } as TextStyle}>Fully offline, no accounts, no tracking. Open source.</Text>
      </Card>
    </Screen>
  );
}
