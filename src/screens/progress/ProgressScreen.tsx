import React, { useState, useCallback, useEffect } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, TextStyle, Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { LineChart, BarChart } from "react-native-gifted-charts";
import { Screen } from "../../components/Screen";
import { SegmentedControl } from "../../components/SegmentedControl";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { QuantityControl } from "../../components/QuantityControl";
import { EmptyState } from "../../components/EmptyState";
import { useTheme } from "../../theme/ThemeContext";
import { useSettingsStore } from "../../stores/settingsStore";
import { kgToDisplay, displayToKg, formatWeight, weightStep } from "../../utils/units";
import { CHART_RANGES, rangeToSince, todayLocalISO, toLocalISO, type ChartRange } from "../../utils/dates";
import * as workoutsRepo from "../../repos/workoutsRepo";
import * as metricsRepo from "../../repos/metricsRepo";
import * as stepsRepo from "../../repos/stepsRepo";
import * as pedometer from "../../services/pedometer";

type Segment = "Exercises" | "Body" | "Steps";

function bmiCategory(bmi: number): string {
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Healthy";
  if (bmi < 30) return "Overweight";
  return "Obese";
}

export function ProgressScreen() {
  const theme = useTheme();
  const unit = useSettingsStore((s) => s.unit);
  const heightCm = useSettingsStore((s) => s.heightCm);
  const setHeightCm = useSettingsStore((s) => s.setHeightCm);
  const stepsEnabled = useSettingsStore((s) => s.stepsEnabled);
  const setStepsEnabled = useSettingsStore((s) => s.setStepsEnabled);
  const [segment, setSegment] = useState<Segment>("Exercises");
  const [range, setRange] = useState<ChartRange>("All");
  const [bodyRange, setBodyRange] = useState<ChartRange>("All");
  const [exerciseNames, setExerciseNames] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [series, setSeries] = useState<workoutsRepo.ProgressPoint[]>([]);

  // Body metrics state
  const [bodyMetrics, setBodyMetrics] = useState<metricsRepo.BodyMetricRow[]>([]);
  const [showLogWeight, setShowLogWeight] = useState(false);
  const [logWeightDisplay, setLogWeightDisplay] = useState<number | null>(null);
  const [showHeightInput, setShowHeightInput] = useState(false);
  const [heightInput, setHeightInput] = useState<string>(heightCm ? String(heightCm) : "");
  // Steps state
  const [todaySteps, setTodaySteps] = useState(0);
  const [last7Steps, setLast7Steps] = useState<stepsRepo.DailyStepsRow[]>([]);
  const [stepsError, setStepsError] = useState<string | null>(null);
  const [stepsNeedsSettings, setStepsNeedsSettings] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHeightInput(heightCm ? String(heightCm) : "");
  }, [heightCm]);

  const loadNames = useCallback(async () => {
    const names = await workoutsRepo.listDistinctExerciseNames();
    setExerciseNames(names);
    setSelected((prev) => (prev && names.includes(prev) ? prev : null));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadNames();
    }, [loadNames])
  );

  const loadSeries = useCallback(async () => {
    if (!selected) {
      setSeries([]);
      return;
    }
    const since = rangeToSince(range);
    const data = await workoutsRepo.getProgressSeries(selected, since);
    setSeries(data);
  }, [selected, range]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSeries();
  }, [loadSeries]);

  const loadBodyMetrics = useCallback(async () => {
    const rows = await metricsRepo.listBodyMetrics();
    setBodyMetrics(rows);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (segment === "Body") void loadBodyMetrics();
    }, [segment, loadBodyMetrics])
  );

  useEffect(() => {
    if (segment === "Body") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadBodyMetrics();
    }
  }, [segment, loadBodyMetrics]);

  const loadSteps = useCallback(async () => {
    const today = await stepsRepo.getTodaySteps();
    setTodaySteps(today);
    const last7 = await stepsRepo.getStepsForLast7Days();
    // Fill missing days with 0 for last 7 dates
    const filled: stepsRepo.DailyStepsRow[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const existing = last7.find((r) => r.date === iso);
      filled.push({ date: iso, steps: existing?.steps ?? 0 });
    }
    setLast7Steps(filled);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (segment === "Steps") void loadSteps();
    }, [segment, loadSteps])
  );

  useEffect(() => {
    if (segment === "Steps" && stepsEnabled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadSteps();
      const id = setInterval(() => {
        void loadSteps();
      }, 2000);
      return () => clearInterval(id);
    }
  }, [segment, stepsEnabled, loadSteps]);

  // Also reload when unit changes? No, series data stays kg, display converts, so no need to refetch.

  const query = filter.trim().toLowerCase();
  const searchMatches =
    query.length === 0 ? [] : exerciseNames.filter((n) => n.toLowerCase().includes(query)).slice(0, 8);

  const handleOpenLogWeight = async () => {
    const latest = bodyMetrics.length > 0 ? bodyMetrics[bodyMetrics.length - 1] : null;
    const display = latest ? kgToDisplay(latest.weight_kg, unit) : kgToDisplay(70, unit);
    setLogWeightDisplay(Math.round(display * 10) / 10);
    setShowLogWeight(true);
  };

  const handleSaveWeight = async () => {
    if (logWeightDisplay === null) return;
    const kg = displayToKg(logWeightDisplay, unit);
    await metricsRepo.upsertBodyMetric(todayLocalISO(), kg);
    setShowLogWeight(false);
    await loadBodyMetrics();
  };

  const handleSaveHeight = async () => {
    const v = Number(heightInput);
    if (!heightInput || Number.isNaN(v) || v <= 0) {
      await setHeightCm(null);
    } else {
      await setHeightCm(v);
    }
    setShowHeightInput(false);
  };

  const latestWeight = bodyMetrics.length > 0 ? bodyMetrics[bodyMetrics.length - 1] : null;
  const bmi = latestWeight && heightCm ? latestWeight.weight_kg / ((heightCm / 100) * (heightCm / 100)) : null;
  const bmiRounded = bmi !== null ? Math.round(bmi * 10) / 10 : null;

  const handleEnableSteps = async () => {
    setStepsError(null);
    const result = await pedometer.enableSteps();
    if (result.granted) {
      await setStepsEnabled(true);
      setStepsNeedsSettings(false);
      await loadSteps();
    } else {
      await setStepsEnabled(false);
      setStepsError(result.message ?? "Permission denied");
      setStepsNeedsSettings(!!result.needsSettings);
      if (result.needsSettings) {
        Alert.alert("Need phone settings", result.message ?? "Permission denied", [
          { text: "Not now", style: "cancel" },
          { text: "Open settings", onPress: () => pedometer.openSystemSettings() },
        ]);
      } else {
        Alert.alert("Step tracking", result.message ?? "Permission denied");
      }
    }
  };

  const renderExercises = () => {
    if (exerciseNames.length === 0) {
      return <EmptyState icon="trending-up-outline" heading="No exercises yet" caption="Log some workouts to see progress" />;
    }

    const best = series.length > 0 ? Math.max(...series.map((p) => p.maxWeightKg)) : null;
    const last = series.length > 0 ? series[series.length - 1].maxWeightKg : null;

    const chartData = series.map((p) => ({
      value: kgToDisplay(p.maxWeightKg, unit),
      label: new Date(p.started_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      dataPointText: formatWeight(p.maxWeightKg, unit),
    }));

    return (
      <View style={{ gap: 16 }}>
        {selected ? (
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.heading.fontSize, fontWeight: "600" } as TextStyle}>{selected}</Text>
        ) : null}
        <TextInput
          value={filter}
          onChangeText={setFilter}
          placeholder={selected ? "Search another exercise" : "Search exercises"}
          placeholderTextColor={theme.colors.textDisabled}
          autoCorrect={false}
          autoCapitalize="none"
          style={{
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: theme.colors.border,
            borderRadius: theme.radii.input,
            paddingHorizontal: 12,
            paddingVertical: 10,
            color: theme.colors.textPrimary,
            backgroundColor: theme.colors.surface,
            fontSize: 15,
          }}
        />

        {query.length > 0 ? (
          <View style={{ gap: 6 }}>
            {searchMatches.map((name) => (
              <Pressable
                key={name}
                onPress={() => {
                  setSelected(name);
                  setFilter("");
                }}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 12,
                  borderRadius: theme.radii.input,
                  backgroundColor: selected === name ? theme.colors.surfaceRaised : theme.colors.surface,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: selected === name ? theme.colors.accent : theme.colors.border,
                }}
              >
                <Text style={{ color: selected === name ? theme.colors.accent : theme.colors.textPrimary, fontWeight: selected === name ? "600" : "400" } as TextStyle}>{name}</Text>
              </Pressable>
            ))}
            {searchMatches.length === 0 ? <Text style={{ color: theme.colors.textSecondary } as TextStyle}>No matches</Text> : null}
          </View>
        ) : null}

        {!selected ? (
          <EmptyState icon="search-outline" heading="Search an exercise" caption="Type a name to see progress. The full list stays out of the way." />
        ) : (
          <>
            <SegmentedControl options={CHART_RANGES} value={range} onChange={setRange} />

            {series.length < 2 ? (
              <EmptyState icon="analytics-outline" heading="Not enough data yet" caption="Need at least 2 sessions for this exercise" />
            ) : (
              <Card>
                <View style={{ overflow: "hidden" }}>
                  <LineChart
                    data={chartData}
                    width={280}
                    height={180}
                    color={theme.colors.accent}
                    thickness={2}
                    dataPointsColor={theme.colors.accent}
                    dataPointsRadius={3}
                    yAxisColor={theme.colors.border}
                    xAxisColor={theme.colors.border}
                    yAxisTextStyle={{ color: theme.colors.textSecondary, fontSize: 10 } as TextStyle}
                    xAxisLabelTextStyle={{ color: theme.colors.textSecondary, fontSize: 10, width: 40 } as TextStyle}
                    noOfSections={4}
                    areaChart
                    startFillColor={theme.colors.accent}
                    endFillColor={theme.colors.accent}
                    startOpacity={0.1}
                    endOpacity={0.01}
                    curved
                    hideDataPoints={false}
                  />
                </View>
              </Card>
            )}

            {series.length >= 2 ? (
              <View style={{ flexDirection: "row", gap: 12 }}>
                <Card style={{ flex: 1, alignItems: "center" }}>
                  <Text style={{ color: theme.colors.textSecondary, fontSize: 12 } as TextStyle}>Best ever</Text>
                  <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.numeral.fontSize, fontWeight: theme.typography.numeral.fontWeight, fontVariant: ["tabular-nums"] as TextStyle["fontVariant"] } as TextStyle}>
                    {best !== null ? `${formatWeight(best, unit)} ${unit}` : "-"}
                  </Text>
                </Card>
                <Card style={{ flex: 1, alignItems: "center" }}>
                  <Text style={{ color: theme.colors.textSecondary, fontSize: 12 } as TextStyle}>Last session</Text>
                  <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.numeral.fontSize, fontWeight: theme.typography.numeral.fontWeight, fontVariant: ["tabular-nums"] as TextStyle["fontVariant"] } as TextStyle}>
                    {last !== null ? `${formatWeight(last, unit)} ${unit}` : "-"}
                  </Text>
                </Card>
              </View>
            ) : null}
          </>
        )}
      </View>
    );
  };

  const renderBody = () => {
    const cutoff = (() => {
      const since = rangeToSince(bodyRange);
      return since === undefined ? null : toLocalISO(since);
    })();
    const filtered = cutoff ? bodyMetrics.filter((m) => m.date >= cutoff) : bodyMetrics;
    const chartData = filtered.map((m) => ({
      value: kgToDisplay(m.weight_kg, unit),
      label: m.date.slice(5),
      dataPointText: formatWeight(m.weight_kg, unit),
    }));

    return (
      <View style={{ gap: 16 }}>
        <Card style={{ gap: 8 }}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: 12 } as TextStyle}>Current weight</Text>
          {latestWeight ? (
            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.numeral.fontSize, fontWeight: theme.typography.numeral.fontWeight, fontVariant: ["tabular-nums"] as TextStyle["fontVariant"] } as TextStyle}>
              {formatWeight(latestWeight.weight_kg, unit)} {unit}
            </Text>
          ) : (
            <Text style={{ color: theme.colors.textSecondary } as TextStyle}>No data yet</Text>
          )}
          {bmiRounded !== null ? (
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radii.pill, backgroundColor: theme.colors.accent }}>
                <Text style={{ color: theme.colors.onAccent, fontSize: 13, fontWeight: "600" } as TextStyle}>BMI {bmiRounded.toFixed(1)} • {bmiCategory(bmiRounded)}</Text>
              </View>
            </View>
          ) : (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <Text style={{ color: theme.colors.textSecondary, fontSize: 13, flexShrink: 1 } as TextStyle}>No BMI — height not set</Text>
              <Button title="Set height" variant="ghost" size="sm" onPress={() => setShowHeightInput(true)} />
            </View>
          )}
        </Card>

        <Button title="+ Log weight" variant="primary" onPress={handleOpenLogWeight} />

        {showLogWeight ? (
          <Card style={{ gap: 12 }}>
            <Text style={{ color: theme.colors.textPrimary, fontWeight: "600" } as TextStyle}>Log weight for today ({todayLocalISO()})</Text>
            <QuantityControl
              label="Weight"
              value={logWeightDisplay}
              onChange={setLogWeightDisplay}
              onIncrement={() => setLogWeightDisplay((v) => (v ?? 0) + weightStep(unit))}
              onDecrement={() => setLogWeightDisplay((v) => Math.max(0, (v ?? 0) - weightStep(unit)))}
              unit={unit}
              placeholder="0"
              accessibilityLabel="Log weight"
            />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Button title="Cancel" variant="secondary" onPress={() => setShowLogWeight(false)} />
              </View>
              <View style={{ flex: 1 }}>
                <Button title="Save" variant="primary" onPress={handleSaveWeight} />
              </View>
            </View>
          </Card>
        ) : null}

        <Card style={{ gap: 12 }}>
          <Text style={{ color: theme.colors.textPrimary, fontWeight: "600" } as TextStyle}>Height</Text>
          {showHeightInput ? (
            <View style={{ gap: 8 }}>
              <TextInput
                value={heightInput}
                onChangeText={setHeightInput}
                placeholder="Height in cm"
                keyboardType="numeric"
                placeholderTextColor={theme.colors.textDisabled}
                style={{
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radii.input,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  color: theme.colors.textPrimary,
                  backgroundColor: theme.colors.surfaceRaised,
                }}
              />
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Button title="Cancel" variant="secondary" onPress={() => setShowHeightInput(false)} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button title="Save" variant="primary" onPress={handleSaveHeight} />
                </View>
              </View>
            </View>
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ color: theme.colors.textSecondary } as TextStyle}>{heightCm ? `${heightCm} cm` : "Not set"}</Text>
              <Button title={heightCm ? "Edit" : "Set height"} variant="ghost" size="sm" onPress={() => setShowHeightInput(true)} />
            </View>
          )}
        </Card>

        <SegmentedControl options={CHART_RANGES} value={bodyRange} onChange={setBodyRange} />

        {filtered.length < 2 ? (
          <EmptyState icon="analytics-outline" heading="Not enough data yet" caption="Need at least 2 entries" />
        ) : (
          <Card>
            <View style={{ overflow: "hidden" }}>
              <LineChart
                data={chartData}
                width={280}
                height={180}
                color={theme.colors.accent}
                thickness={2}
                dataPointsColor={theme.colors.accent}
                dataPointsRadius={3}
                yAxisColor={theme.colors.border}
                xAxisColor={theme.colors.border}
                yAxisTextStyle={{ color: theme.colors.textSecondary, fontSize: 10 } as TextStyle}
                xAxisLabelTextStyle={{ color: theme.colors.textSecondary, fontSize: 10, width: 40 } as TextStyle}
                noOfSections={4}
                areaChart
                startFillColor={theme.colors.accent}
                endFillColor={theme.colors.accent}
                startOpacity={0.1}
                endOpacity={0.01}
                curved
              />
            </View>
          </Card>
        )}
      </View>
    );
  };

  const renderSteps = () => {
    if (!stepsEnabled) {
      return (
        <View style={{ gap: 12 }}>
          <EmptyState icon="footsteps-outline" heading="Step tracking is off" caption="Enable step tracking to count steps throughout the day, including while the app is in the background." buttonTitle="Enable step tracking" onButtonPress={handleEnableSteps} />
          {stepsError ? (
            <View style={{ gap: 8 }}>
              <Text style={{ color: theme.colors.danger, fontSize: 13, textAlign: "center" } as TextStyle}>{stepsError}</Text>
              {stepsNeedsSettings ? <Button title="Open system settings" variant="secondary" onPress={() => pedometer.openSystemSettings()} /> : null}
            </View>
          ) : null}
        </View>
      );
    }

    const barData = last7Steps.map((r) => ({
      value: r.steps,
      label: r.date.slice(5),
      frontColor: theme.colors.accent,
    }));

    return (
      <View style={{ gap: 16 }}>
        <Card style={{ alignItems: "center", gap: 8 }}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: 12 } as TextStyle}>Today</Text>
          <Text style={{ color: theme.colors.textPrimary, fontSize: 36, fontWeight: "700", fontVariant: ["tabular-nums"] as TextStyle["fontVariant"] } as TextStyle}>{todaySteps}</Text>
          <Text style={{ color: theme.colors.textSecondary, fontSize: 13 } as TextStyle}>steps</Text>
        </Card>

        <Card>
          <Text style={{ color: theme.colors.textPrimary, fontWeight: "600", marginBottom: 8 } as TextStyle}>Last 7 days</Text>
          <View style={{ overflow: "hidden" }}>
            <BarChart
              data={barData}
              width={280}
              height={160}
              barWidth={18}
              barBorderRadius={4}
              yAxisColor={theme.colors.border}
              xAxisColor={theme.colors.border}
              yAxisTextStyle={{ color: theme.colors.textSecondary, fontSize: 10 } as TextStyle}
              xAxisLabelTextStyle={{ color: theme.colors.textSecondary, fontSize: 10 } as TextStyle}
              noOfSections={4}
              yAxisThickness={1}
              xAxisThickness={1}
            />
          </View>
        </Card>

        <Text style={{ color: theme.colors.textSecondary, fontSize: 12, textAlign: "center" } as TextStyle}>Your phone counts steps all day. TrackFit syncs them when the app is open, including steps taken while you were away.</Text>
      </View>
    );
  };

  return (
    <Screen>
      <SegmentedControl options={["Exercises", "Body", "Steps"] as const} value={segment} onChange={setSegment as (v: Segment) => void} />

      {segment === "Exercises" ? renderExercises() : null}
      {segment === "Body" ? renderBody() : null}
      {segment === "Steps" ? renderSteps() : null}
    </Screen>
  );
}
