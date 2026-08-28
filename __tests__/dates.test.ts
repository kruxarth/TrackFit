import { CHART_RANGES, rangeToSince } from "../src/utils/dates";

describe("chart ranges", () => {
  it("includes 1M as the shortest window", () => {
    expect(CHART_RANGES[0]).toBe("1M");
    expect(CHART_RANGES).toEqual(["1M", "3M", "6M", "1Y", "All"]);
  });

  it("maps 1M to about one month ago and All to unbounded", () => {
    const oneMonth = rangeToSince("1M");
    const threeMonths = rangeToSince("3M");
    expect(oneMonth).toBeDefined();
    expect(threeMonths).toBeDefined();
    expect(oneMonth!).toBeGreaterThan(threeMonths!);
    expect(rangeToSince("All")).toBeUndefined();
  });
});
