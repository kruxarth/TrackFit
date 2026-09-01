import * as Updates from "expo-updates";
import { prepareAppUpdate, applyAppUpdate } from "../src/services/appUpdates";

jest.mock("expo-updates", () => ({
  isEnabled: true,
  checkForUpdateAsync: jest.fn(),
  fetchUpdateAsync: jest.fn(),
  reloadAsync: jest.fn(),
}));

const mockedUpdates = Updates as jest.Mocked<typeof Updates>;

function setEnabled(value: boolean) {
  Object.defineProperty(Updates, "isEnabled", { configurable: true, value });
}

describe("prepareAppUpdate", () => {
  beforeEach(() => {
    setEnabled(true);
    mockedUpdates.checkForUpdateAsync.mockReset();
    mockedUpdates.fetchUpdateAsync.mockReset();
    mockedUpdates.reloadAsync.mockReset();
  });

  it("returns disabled when expo-updates is off (Expo Go / debug)", async () => {
    setEnabled(false);
    await expect(prepareAppUpdate()).resolves.toEqual({ status: "disabled" });
    expect(mockedUpdates.checkForUpdateAsync).not.toHaveBeenCalled();
  });

  it("returns ready without hitting the network if an update is already downloaded", async () => {
    await expect(prepareAppUpdate(true)).resolves.toEqual({ status: "ready" });
    expect(mockedUpdates.checkForUpdateAsync).not.toHaveBeenCalled();
  });

  it("fetches when the server has an update", async () => {
    mockedUpdates.checkForUpdateAsync.mockResolvedValue({
      isAvailable: true,
      isRollBackToEmbedded: false,
    } as Awaited<ReturnType<typeof Updates.checkForUpdateAsync>>);
    mockedUpdates.fetchUpdateAsync.mockResolvedValue({
      isNew: true,
      isRollBackToEmbedded: false,
    } as Awaited<ReturnType<typeof Updates.fetchUpdateAsync>>);
    await expect(prepareAppUpdate()).resolves.toEqual({ status: "ready" });
    expect(mockedUpdates.fetchUpdateAsync).toHaveBeenCalled();
  });

  it("returns up-to-date when the server has nothing new", async () => {
    mockedUpdates.checkForUpdateAsync.mockResolvedValue({
      isAvailable: false,
      isRollBackToEmbedded: false,
    } as Awaited<ReturnType<typeof Updates.checkForUpdateAsync>>);
    await expect(prepareAppUpdate()).resolves.toEqual({ status: "up-to-date" });
    expect(mockedUpdates.fetchUpdateAsync).not.toHaveBeenCalled();
  });
});

describe("applyAppUpdate", () => {
  it("reloads the app", async () => {
    mockedUpdates.reloadAsync.mockResolvedValue(undefined);
    await applyAppUpdate();
    expect(mockedUpdates.reloadAsync).toHaveBeenCalled();
  });
});
