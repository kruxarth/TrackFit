import * as Updates from "expo-updates";

export type AppUpdateCheck = { status: "disabled" } | { status: "up-to-date" } | { status: "ready" };

export async function prepareAppUpdate(alreadyPending = false): Promise<AppUpdateCheck> {
  if (!Updates.isEnabled) {
    return { status: "disabled" };
  }
  if (alreadyPending) {
    return { status: "ready" };
  }

  const check = await Updates.checkForUpdateAsync();
  if (check.isAvailable || check.isRollBackToEmbedded) {
    await Updates.fetchUpdateAsync();
    return { status: "ready" };
  }
  return { status: "up-to-date" };
}

export async function applyAppUpdate(): Promise<void> {
  await Updates.reloadAsync();
}
