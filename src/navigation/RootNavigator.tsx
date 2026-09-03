import React from "react";
import { NavigationContainer, DefaultTheme, DarkTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeContext";
import { TrainHomeScreen } from "../screens/train/TrainHomeScreen";
import { DayEditorScreen } from "../screens/train/DayEditorScreen";
import { WorkoutScreen } from "../screens/train/WorkoutScreen";
import { HistoryScreen } from "../screens/train/HistoryScreen";
import { LogDetailScreen } from "../screens/train/LogDetailScreen";
import { ProgressScreen } from "../screens/progress/ProgressScreen";
import { SettingsScreen } from "../screens/settings/SettingsScreen";

export type TrainStackParamList = {
  TrainHome: undefined;
  DayEditor: { dayId: number };
  Workout: { logId: number };
  History: undefined;
  LogDetail: { logId: number };
};

export type RootTabParamList = {
  Train: undefined;
  Progress: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator<TrainStackParamList>();

function TrainStack() {
  const theme = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.bg },
        headerTintColor: theme.colors.textPrimary,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.colors.bg },
        headerTitleStyle: { color: theme.colors.textPrimary },
      }}
    >
      <Stack.Screen name="TrainHome" component={TrainHomeScreen} options={{ title: "Train" }} />
      <Stack.Screen name="DayEditor" component={DayEditorScreen} options={{ title: "Edit Day" }} />
      <Stack.Screen name="Workout" component={WorkoutScreen} options={{ title: "Workout" }} />
      <Stack.Screen name="History" component={HistoryScreen} options={{ title: "History" }} />
      <Stack.Screen name="LogDetail" component={LogDetailScreen} options={{ title: "Workout Detail" }} />
    </Stack.Navigator>
  );
}

export function RootNavigator() {
  const theme = useTheme();

  const navTheme = {
    ...(theme.isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(theme.isDark ? DarkTheme.colors : DefaultTheme.colors),
      background: theme.colors.bg,
      card: theme.colors.surface,
      text: theme.colors.textPrimary,
      border: theme.colors.border,
      primary: theme.colors.accent,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ color, size }: { color: string; size: number }) => {
            let icon: keyof typeof Ionicons.glyphMap = "barbell-outline";
            if (route.name === "Train") icon = "barbell-outline";
            else if (route.name === "Progress") icon = "trending-up-outline";
            else if (route.name === "Settings") icon = "settings-outline";
            return <Ionicons name={icon} size={size} color={color} />;
          },
          tabBarActiveTintColor: theme.colors.accent,
          tabBarInactiveTintColor: theme.colors.textSecondary,
          tabBarStyle: { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border },
          tabBarHideOnKeyboard: true,
          headerStyle: { backgroundColor: theme.colors.bg },
          headerTintColor: theme.colors.textPrimary,
          headerShadowVisible: false,
          headerTitleStyle: { color: theme.colors.textPrimary },
        })}
      >
        <Tab.Screen name="Train" component={TrainStack} options={{ headerShown: false }} />
        <Tab.Screen name="Progress" component={ProgressScreen} />
        <Tab.Screen name="Settings" component={SettingsScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
