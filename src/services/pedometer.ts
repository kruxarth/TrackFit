import { Pedometer } from "expo-sensors";
import Constants from "expo-constants";
import { AppState, AppStateStatus, Linking, PermissionsAndroid, Platform } from "react-native";
import * as stepsRepo from "../repos/stepsRepo";
import { addLocalDays, startOfLocalDay, todayLocalISO, toLocalISO } from "../utils/dates";

let subscription: { remove: () => void } | null = null;
let appStateSub: { remove: () => void } | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let isWatching = false;
let lastWatchSteps: number | null = null;

async function onStepCount(result: { steps: number }) {
  if (lastWatchSteps === null) {
    lastWatchSteps = result.steps;
    return;
  }
  const delta = result.steps - lastWatchSteps;
  lastWatchSteps = result.steps;
  if (delta <= 0) return;
  await stepsRepo.upsertAddSteps(todayLocalISO(), delta);
}

let syncPromise: Promise<boolean> | null = null;
let startPromise: Promise<void> | null = null;

async function syncHistoricalSteps(dayCount = 7): Promise<boolean> {
  if (syncPromise) return syncPromise;
  syncPromise = (async () => {
    const end = new Date();
    const startOffset = Math.max(0, dayCount - 1);
    for (let i = startOffset; i >= 0; i--) {
      const dayStart = startOfLocalDay(addLocalDays(end, -i));
      const dayEnd = i === 0 ? end : addLocalDays(dayStart, 1);
      try {
        const result = await Pedometer.getStepCountAsync(dayStart, dayEnd);
        if (result) {
          await stepsRepo.setDailySteps(toLocalISO(dayStart.getTime()), Math.max(0, Math.round(result.steps)));
        }
      } catch {
        return false;
      }
    }
    return true;
  })();
  try {
    return await syncPromise;
  } finally {
    syncPromise = null;
  }
}

function handleAppState(next: AppStateStatus) {
  if (next !== "active" || !isWatching) return;
  void syncHistoricalSteps();
}

export async function isPedometerAvailable(): Promise<boolean> {
  return Pedometer.isAvailableAsync();
}

export async function requestPermissions(): Promise<boolean> {
  const { status } = await Pedometer.requestPermissionsAsync();
  return status === "granted";
}

export async function startWatching(): Promise<void> {
  if (isWatching) {
    void syncHistoricalSteps();
    return;
  }
  if (startPromise) return startPromise;

  startPromise = (async () => {
    const available = await Pedometer.isAvailableAsync();
    if (!available) throw new Error("Pedometer not available");

    const synced = await syncHistoricalSteps();

    if (!synced) {
      lastWatchSteps = null;
      subscription = Pedometer.watchStepCount(onStepCount);
    } else if (Platform.OS === "ios") {
      pollTimer = setInterval(() => {
        void syncHistoricalSteps(1);
      }, 5000);
    } else {
      lastWatchSteps = null;
      subscription = Pedometer.watchStepCount(onStepCount);
    }

    isWatching = true;
    if (!appStateSub) {
      appStateSub = AppState.addEventListener("change", handleAppState);
    }
  })();

  try {
    await startPromise;
  } finally {
    startPromise = null;
  }
}

export function stopWatching(): void {
  if (subscription) {
    subscription.remove();
    subscription = null;
  }
  if (appStateSub) {
    appStateSub.remove();
    appStateSub = null;
  }
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  isWatching = false;
  lastWatchSteps = null;
}

export function openSystemSettings(): void {
  void Linking.openSettings();
}

export function isExpoGo(): boolean {
  return Constants.appOwnership === "expo";
}

function permissionDeniedMessage(): string {
  if (Platform.OS === "android") {
    return "Allow Physical activity for TrackFit in system settings: Apps → TrackFit → Permissions.";
  }
  return "Allow Motion & Fitness for TrackFit in iPhone Settings.";
}

async function requestAndroidActivityPermission(): Promise<boolean> {
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION, {
    title: "Step counting",
    message: "TrackFit uses Physical activity permission to count steps.",
    buttonPositive: "Allow",
    buttonNegative: "Deny",
  });
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

export async function enableSteps(): Promise<{ granted: boolean; message?: string; needsSettings?: boolean }> {
  if (Platform.OS === "android" && isExpoGo()) {
    return {
      granted: false,
      needsSettings: false,
      message:
        "Expo Go does not include Physical activity permission, so that toggle will not appear in Expo Go's settings. Step counting works in a TrackFit build, not inside Expo Go.",
    };
  }

  const granted = Platform.OS === "android" ? await requestAndroidActivityPermission() : await requestPermissions();
  if (!granted) {
    return { granted: false, needsSettings: true, message: permissionDeniedMessage() };
  }
  try {
    await startWatching();
    return { granted: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { granted: false, message: msg };
  }
}

export function disableSteps(): void {
  stopWatching();
}
