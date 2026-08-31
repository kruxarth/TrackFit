import React, { useState, useEffect, useCallback } from "react";
import { View, Text, TextInput, Pressable, Alert, StyleSheet, TextStyle } from "react-native";
import { useRoute, RouteProp, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../components/Screen";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { SetRow } from "../../components/SetRow";
import { useTheme } from "../../theme/ThemeContext";
import { useSettingsStore } from "../../stores/settingsStore";
import { kgToDisplay, displayToKg, weightStep, toggleUnit, resolveExerciseUnit, type Unit } from "../../utils/units";
import { getDatabase } from "../../db/database";
import type { TrainStackParamList } from "../../navigation/RootNavigator";
import type { LoggedExerciseRow, LoggedSetRow } from "../../repos/workoutsRepo";

type Route = RouteProp<TrainStackParamList, "LogDetail">;
type Nav = NativeStackNavigationProp<TrainStackParamList>;

export function LogDetailScreen() {
  const theme = useTheme();
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { logId } = route.params;
  const fallbackUnit = useSettingsStore((s) => s.unit);

  const [log, setLog] = useState<{ day_name_snapshot: string; started_at: number } | null>(null);
  const [exercises, setExercises] = useState<{ exercise: LoggedExerciseRow; sets: LoggedSetRow[] }[]>([]);
  const [newExerciseName, setNewExerciseName] = useState("");
  const [newExerciseBW, setNewExerciseBW] = useState(false);
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [showWeightForBW, setShowWeightForBW] = useState<Record<number, boolean>>({});
  const [scrollLocked, setScrollLocked] = useState(false);

  const load = useCallback(async () => {
    const db = await getDatabase();
    const l = await db.getFirstAsync<{ day_name_snapshot: string; started_at: number }>("SELECT day_name_snapshot, started_at FROM workout_logs WHERE id = ?", [logId]);
    if (!l) {
      Alert.alert("Not found", "Workout not found");
      navigation.goBack();
      return;
    }
    setLog(l);
    const exRows = await db.getAllAsync<LoggedExerciseRow>("SELECT * FROM logged_exercises WHERE workout_log_id = ? ORDER BY position ASC, id ASC", [logId]);
    const result: typeof exercises = [];
    for (const ex of exRows) {
      const sets = await db.getAllAsync<LoggedSetRow>("SELECT * FROM logged_sets WHERE logged_exercise_id = ? ORDER BY set_number ASC, id ASC", [ex.id]);
      result.push({ exercise: ex, sets });
    }
    setExercises(result);
  }, [logId, navigation]);

  const lockScroll = useCallback((locked: boolean) => {
    setScrollLocked((prev) => (prev === locked ? prev : locked));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const handleNotesBlur = async (exerciseId: number, notes: string) => {
    const db = await getDatabase();
    await db.runAsync("UPDATE logged_exercises SET notes = ? WHERE id = ?", [notes || null, exerciseId]);
  };

  const handleWeightChange = async (setId: number, displayVal: number | null, unit: Unit) => {
    const kg = displayVal === null ? null : displayToKg(displayVal, unit);
    const db = await getDatabase();
    await db.runAsync("UPDATE logged_sets SET weight_kg = ? WHERE id = ?", [kg, setId]);
    await load();
  };

  const handleRepsChange = async (setId: number, val: number | null) => {
    const reps = val === null ? null : Math.max(0, Math.round(val));
    const db = await getDatabase();
    await db.runAsync("UPDATE logged_sets SET reps = ? WHERE id = ?", [reps, setId]);
    await load();
  };

  const handleWeightStepper = async (set: LoggedSetRow, deltaDisplay: number, unit: Unit) => {
    const currentDisplay = set.weight_kg === null ? 0 : kgToDisplay(set.weight_kg, unit);
    const nextDisplay = Math.max(0, currentDisplay + deltaDisplay);
    const kg = displayToKg(nextDisplay, unit);
    const db = await getDatabase();
    await db.runAsync("UPDATE logged_sets SET weight_kg = ? WHERE id = ?", [kg, set.id]);
    await load();
  };

  const handleRepsStepper = async (set: LoggedSetRow, delta: number) => {
    const current = set.reps ?? 0;
    const next = Math.max(0, current + delta);
    const db = await getDatabase();
    await db.runAsync("UPDATE logged_sets SET reps = ? WHERE id = ?", [next === 0 ? null : next, set.id]);
    await load();
  };

  const handleAddSet = async (exerciseId: number) => {
    const db = await getDatabase();
    const maxRow = await db.getFirstAsync<{ maxNum: number | null }>("SELECT MAX(set_number) as maxNum FROM logged_sets WHERE logged_exercise_id = ?", [exerciseId]);
    const next = (maxRow?.maxNum ?? 0) + 1;
    await db.runAsync("INSERT INTO logged_sets (logged_exercise_id, set_number, weight_kg, reps, is_confirmed, completed_at) VALUES (?, ?, ?, ?, 1, ?)", [exerciseId, next, null, null, Date.now()]);
    await load();
  };

  const handleDeleteSet = async (setId: number) => {
    const db = await getDatabase();
    await db.runAsync("DELETE FROM logged_sets WHERE id = ?", [setId]);
    await load();
  };

  const handleAddExercise = async () => {
    const name = newExerciseName.trim();
    if (!name) {
      Alert.alert("Invalid", "Exercise name cannot be empty");
      return;
    }
    const db = await getDatabase();
    const maxRow = await db.getFirstAsync<{ maxPos: number | null }>("SELECT MAX(position) as maxPos FROM logged_exercises WHERE workout_log_id = ?", [logId]);
    const nextPos = (maxRow?.maxPos ?? -1) + 1;
    const prev = await db.getFirstAsync<{ weight_unit: string | null }>(
      `SELECT le.weight_unit FROM logged_exercises le
       JOIN workout_logs wl ON le.workout_log_id = wl.id
       WHERE LOWER(TRIM(le.name)) = LOWER(TRIM(?)) AND le.weight_unit IN ('kg','lbs')
       ORDER BY wl.started_at DESC LIMIT 1`,
      [name]
    );
    const weightUnit = resolveExerciseUnit(prev?.weight_unit, fallbackUnit);
    const res = await db.runAsync(
      "INSERT INTO logged_exercises (workout_log_id, name, is_bodyweight, position, weight_unit) VALUES (?, ?, ?, ?, ?)",
      [logId, name, newExerciseBW ? 1 : 0, nextPos, weightUnit]
    );
    const newId = res.lastInsertRowId;
    await db.runAsync("INSERT INTO logged_sets (logged_exercise_id, set_number, weight_kg, reps, is_confirmed, completed_at) VALUES (?, ?, ?, ?, 1, ?)", [newId, 1, null, null, Date.now()]);
    setNewExerciseName("");
    setNewExerciseBW(false);
    setShowAddExercise(false);
    await load();
  };

  const toggleShowWeight = (exerciseId: number) => {
    setShowWeightForBW((prev) => ({ ...prev, [exerciseId]: !prev[exerciseId] }));
  };

  const handleToggleUnit = async (exerciseId: number, current: Unit) => {
    const next = toggleUnit(current);
    const db = await getDatabase();
    await db.runAsync("UPDATE logged_exercises SET weight_unit = ? WHERE id = ?", [next, exerciseId]);
    await load();
  };

  const handleDeleteWorkout = () => {
    Alert.alert("Delete workout?", "This will permanently delete this workout and all its data.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const db = await getDatabase();
          await db.runAsync("DELETE FROM workout_logs WHERE id = ?", [logId]);
          navigation.goBack();
        },
      },
    ]);
  };

  const handleDeleteExercise = (exerciseId: number) => {
    Alert.alert("Delete exercise?", "This will delete the exercise and all its sets.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const db = await getDatabase();
          await db.runAsync("DELETE FROM logged_exercises WHERE id = ?", [exerciseId]);
          await load();
        },
      },
    ]);
  };

  if (!log) {
    return (
      <Screen>
        <Text style={{ color: theme.colors.textPrimary }}>Loading...</Text>
      </Screen>
    );
  }

  return (
    <Screen scrollEnabled={!scrollLocked} scrollToEndKey={showAddExercise}>
      <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.heading.fontSize, fontWeight: theme.typography.heading.fontWeight } as TextStyle}>{log.day_name_snapshot}</Text>
      <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize } as TextStyle}>{new Date(log.started_at).toLocaleDateString()}</Text>

      {exercises.map(({ exercise, sets }) => {
        const showWeight = exercise.is_bodyweight ? !!showWeightForBW[exercise.id] : true;
        const unit = resolveExerciseUnit(exercise.weight_unit, fallbackUnit);
        const step = weightStep(unit);
        return (
          <Card key={exercise.id} style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.heading.fontSize, fontWeight: theme.typography.heading.fontWeight } as TextStyle}>{exercise.name}</Text>
              <Pressable onPress={() => handleDeleteExercise(exercise.id)} accessibilityLabel="Delete exercise">
                <Ionicons name="trash-outline" size={18} color={theme.colors.danger} />
              </Pressable>
            </View>
            <TextInput
              defaultValue={exercise.notes ?? ""}
              placeholder="Notes"
              placeholderTextColor={theme.colors.textDisabled}
              onBlur={(e: any) => handleNotesBlur(exercise.id, e.nativeEvent.text)}
              style={{
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: theme.colors.border,
                borderRadius: theme.radii.input,
                paddingHorizontal: 8,
                paddingVertical: 6,
                color: theme.colors.textPrimary,
                backgroundColor: theme.colors.surfaceRaised,
                fontSize: 14,
              }}
            />

            {sets.map((s) => {
              const displayWeight = s.weight_kg === null ? null : kgToDisplay(s.weight_kg, unit);
              return (
                <SetRow
                  key={s.id}
                  setNumber={s.set_number}
                  unit={unit}
                  displayWeight={displayWeight}
                  reps={s.reps}
                  showWeight={showWeight}
                  isBodyweight={exercise.is_bodyweight === 1}
                  confirmed
                  showConfirm={false}
                  weightStep={step}
                  onWeightChange={(v) => handleWeightChange(s.id, v, unit)}
                  onWeightStep={(delta) => handleWeightStepper(s, delta, unit)}
                  onRepsChange={(v) => handleRepsChange(s.id, v)}
                  onRepsStep={(delta) => handleRepsStepper(s, delta)}
                  onDelete={() => handleDeleteSet(s.id)}
                  onToggleExtraWeight={() => toggleShowWeight(exercise.id)}
                  onUnitPress={() => handleToggleUnit(exercise.id, unit)}
                  onLockScroll={lockScroll}
                />
              );
            })}

            <Button title="+ Add set" variant="secondary" size="sm" onPress={() => handleAddSet(exercise.id)} />
          </Card>
        );
      })}

      {showAddExercise ? (
        <Card style={{ gap: 8 }}>
          <TextInput
            value={newExerciseName}
            onChangeText={setNewExerciseName}
            placeholder="Exercise name"
            placeholderTextColor={theme.colors.textDisabled}
            autoFocus
            style={{
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.input,
              paddingHorizontal: 12,
              paddingVertical: 10,
              color: theme.colors.textPrimary,
              backgroundColor: theme.colors.surfaceRaised,
              fontSize: 15,
            }}
          />
          <Pressable onPress={() => setNewExerciseBW(!newExerciseBW)} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name={newExerciseBW ? "checkbox" : "square-outline"} size={20} color={newExerciseBW ? theme.colors.accent : theme.colors.textSecondary} />
            <Text style={{ color: theme.colors.textPrimary } as TextStyle}>Bodyweight</Text>
            <Ionicons name="body-outline" size={16} color={newExerciseBW ? theme.colors.accent : theme.colors.textDisabled} />
          </Pressable>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Button title="Cancel" variant="secondary" onPress={() => setShowAddExercise(false)} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title="Add" variant="primary" onPress={handleAddExercise} />
            </View>
          </View>
        </Card>
      ) : (
        <Button title="+ Add exercise" variant="secondary" onPress={() => setShowAddExercise(true)} />
      )}

      <View style={{ marginTop: 24 }}>
        <Button title="Delete workout" variant="danger" onPress={handleDeleteWorkout} />
      </View>
    </Screen>
  );
}
