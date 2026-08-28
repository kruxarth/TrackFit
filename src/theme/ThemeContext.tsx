import React, { createContext, useContext, useMemo } from "react";
import { useColorScheme } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSettingsStore, type ThemePreference } from "../stores/settingsStore";
import { darkTheme, lightTheme, Theme } from "./tokens";

const ThemeContext = createContext<Theme>(lightTheme);

function resolveTheme(preference: ThemePreference, systemScheme: string | null | undefined): Theme {
  if (preference === "dark") return darkTheme;
  if (preference === "light") return lightTheme;
  return systemScheme === "dark" ? darkTheme : lightTheme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const preference = useSettingsStore((s) => s.themePreference);
  const theme = useMemo(() => resolveTheme(preference, scheme), [preference, scheme]);

  return (
    <ThemeContext.Provider value={theme}>
      <StatusBar style={theme.isDark ? "light" : "dark"} />
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
