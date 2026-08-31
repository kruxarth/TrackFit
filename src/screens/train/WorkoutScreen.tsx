import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { View, Text, TextInput, Pressable, Alert, StyleSheet, TextStyle, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { useRoute, RouteProp, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Screen, useKeyboardHeight } from "../../components/Screen";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { SetRow } from "../../components/SetRow";
import { useTheme } from "../../theme/ThemeContext";
import { useSettingsStore } from "../../stores/settingsStore";
import { useWorkoutStore } from "../../stores/workoutStore";
import { kgToDisplay, displayToKg, weightStep, toggleUnit, resolveExerciseUnit, type Unit } from "../../utils/units";
import { getDatabase } from "../../db/database";
import { RestTimerBar } from "../../components/RestTimerBar";
import type { TrainStackParamList } from "../../navigation/RootNavigator";
import type { LoggedExerciseRow, LoggedSetRow } from "../../repos/workoutsRepo";

type Route = RouteProp<TrainStackParamList, "Workout">;
type ExerciseItem = { exercise: LoggedExerciseRow; sets: LoggedSetRow[] };

type ExerciseBlockProps = {
  item: ExerciseItem;
  fallbackUnit: Unit;
  restEnabled: boolean;
  showWeightForBW: boolean;
  onLockScroll: (locked: boolean) => void;
  onNotesBlur: (exerciseId: number, notes: string) => void;
  onWeightChange: (setId: number, displayVal: number | null, unit: Unit) => void;
  onWeightStep: (set: LoggedSetRow, deltaDisplay: number, unit: Unit) => void;
  onRepsChange: (setId: number, val: number | null) => void;
  onRepsStep: (set: LoggedSetRow, delta: number) => void;
  onConfirm: (set: LoggedSetRow, exercise: LoggedExerciseRow, showWeight: boolean) => void;
  onDeleteSet: (setId: number) => void;
  onAddSet: (exerciseId: number) => void;
  onToggleExtraWeight: (exerciseId: number) => void;
  onToggleUnit: (exerciseId: number, current: Unit) => void;
};

const ExerciseBlock = React.memo(function ExerciseBlock({
  item,
  fallbackUnit,
  restEnabled,
  showWeightForBW,
  onLockScroll,
  onNotesBlur,
  onWeightChange,
  onWeightStep,
  onRepsChange,
  onRepsStep,
  onConfirm,
  onDeleteSet,
  onAddSet,
  onToggleExtraWeight,
  onToggleUnit,
}: ExerciseBlockProps) {
  const theme = useTheme();
  const { exercise, sets } = item;
  const unit = resolveExerciseUnit(exercise.weight_unit, fallbackUnit);
  const step = weightStep(unit);
  const showWeight = exercise.is_bodyweight ? showWeightForBW : true;

  return (
    <Card style={{ gap: 12 }}>
      <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.heading.fontSize, fontWeight: theme.typography.heading.fontWeight } as TextStyle}>{exercise.name}</Text>
      <TextInput
        defaultValue={exercise.notes ?? ""}
        placeholder="Notes"
        placeholderTextColor={theme.colors.textDisabled}
        onBlur={(e: any) => onNotesBlur(exercise.id, e.nativeEvent.text)}
        style={notesInputStyle(theme)}
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
            confirmed={s.is_confirmed === 1}
            showConfirm
            restEnabled={restEnabled}
            weightStep={step}
            onWeightChange={(v) => onWeightChange(s.id, v, unit)}
            onWeightStep={(delta) => onWeightStep(s, delta, unit)}
            onRepsChange={(v) => onRepsChange(s.id, v)}
            onRepsStep={(delta) => onRepsStep(s, delta)}
            onConfirm={() => onConfirm(s, exercise, showWeight)}
            onDelete={() => onDeleteSet(s.id)}
            onToggleExtraWeight={() => onToggleExtraWeight(exercise.id)}
            onUnitPress={() => onToggleUnit(exercise.id, unit)}
            onLockScroll={onLockScroll}
          />
        );
      })}

      <Button title="+ Add set" variant="secondary" size="sm" onPress={() => onAddSet(exercise.id)} />
    </Card>
  );
});

function notesInputStyle(theme: ReturnType<typeof useTheme>): TextStyle {
  return {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.input,
    paddingHorizontal: 8,
    paddingVertical: 6,
    color: theme.colors.textPrimary,
    backgroundColor: theme.colors.surfaceRaised,
    fontSize: 14,
  };
}

export function WorkoutScreen() {
  const theme = useTheme();
  const route = useRoute<Route>();
  const navigation = useNavigation<NativeStackNavigationProp<TrainStackParamList>>();
  const { logId } = route.params;
  const fallbackUnit = useSettingsStore((s) => s.unit);
  const restEnabled = useSettingsStore((s) => s.restTimerEnabled);
  const restSeconds = useSettingsStore((s) => s.restTimerSeconds);
  const setActiveLogId = useWorkoutStore((s) => s.setActiveLogId);
  const clearWorkout = useWorkoutStore((s) => s.clear);
  const hydrateWorkout = useWorkoutStore((s) => s.hydrate);
  const setRestTimerEndsAt = useWorkoutStore((s) => s.setRestTimerEndsAt);
  const restEndsAt = useWorkoutStore((s) => s.restTimerEndsAt);

  const [log, setLog] = useState<{ day_name_snapshot: string; started_at: number } | null>(null);
  const [exercises, setExercises] = useState<ExerciseItem[]>([]);
  const [scrollLocked, setScrollLocked] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState("");
  const [newExerciseBW, setNewExerciseBW] = useState(false);
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [showWeightForBW, setShowWeightForBW] = useState<Record<number, boolean>>({});
  const loadRunning = useRef(false);
  const loadQueued = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const keyboardHeight = useKeyboardHeight();

  const load = useCallback(async () => {
    if (loadRunning.current) {
      loadQueued.current = true;
      return;
    }
    loadRunning.current = true;
    try {
      do {
        loadQueued.current = false;
        const db = await getDatabase();
        const id = logId === -1 ? (await db.getFirstAsync<{ id: number }>("SELECT id FROM workout_logs WHERE status='active' ORDER BY started_at DESC LIMIT 1"))?.id ?? logId : logId;
        if (id === -1 || id === undefined) return;
        const l = await db.getFirstAsync<{ day_name_snapshot: string; started_at: number }>("SELECT day_name_snapshot, started_at FROM workout_logs WHERE id = ?", [id]);
        if (l) setLog(l);
        const exRows = await db.getAllAsync<LoggedExerciseRow>("SELECT * FROM logged_exercises WHERE workout_log_id = ? ORDER BY position ASC, id ASC", [id]);
        const result: ExerciseItem[] = [];
        for (const ex of exRows) {
          const sets = await db.getAllAsync<LoggedSetRow>("SELECT * FROM logged_sets WHERE logged_exercise_id = ? ORDER BY set_number ASC, id ASC", [ex.id]);
          result.push({ exercise: ex, sets });
        }
        setExercises(result);
        if (id !== -1) {
          setActiveLogId(id);
        }
      } while (loadQueued.current);
    } finally {
      loadRunning.current = false;
    }
  }, [logId, setActiveLogId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!showAddExercise) return;
    const t = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 80);
    return () => clearTimeout(t);
  }, [showAddExercise, keyboardHeight]);

  const lockScroll = useCallback((locked: boolean) => {
    setScrollLocked((prev) => (prev === locked ? prev : locked));
  }, []);

  const patchSet = useCallback((setId: number, patch: Partial<LoggedSetRow>) => {
    setExercises((prev) =>
      prev.map((item) => {
        if (!item.sets.some((s) => s.id === setId)) return item;
        return {
          ...item,
          sets: item.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)),
        };
      })
    );
  }, []);

  const handleNotesBlur = useCallback(async (exerciseId: number, notes: string) => {
    const db = await getDatabase();
    await db.runAsync("UPDATE logged_exercises SET notes = ? WHERE id = ?", [notes || null, exerciseId]);
  }, []);

  const handleWeightChange = useCallback(async (setId: number, displayVal: number | null, unit: Unit) => {
    const kg = displayVal === null ? null : displayToKg(displayVal, unit);
    patchSet(setId, { weight_kg: kg });
    const db = await getDatabase();
    await db.runAsync("UPDATE logged_sets SET weight_kg = ? WHERE id = ?", [kg, setId]);
  }, [patchSet]);

  const handleRepsChange = useCallback(async (setId: number, val: number | null) => {
    const reps = val === null ? null : Math.max(0, Math.round(val));
    patchSet(setId, { reps });
    const db = await getDatabase();
    await db.runAsync("UPDATE logged_sets SET reps = ? WHERE id = ?", [reps, setId]);
  }, [patchSet]);

  const handleWeightStepper = useCallback(async (set: LoggedSetRow, deltaDisplay: number, unit: Unit) => {
    const currentDisplay = set.weight_kg === null ? 0 : kgToDisplay(set.weight_kg, unit);
    const nextDisplay = Math.max(0, currentDisplay + deltaDisplay);
    const kg = displayToKg(nextDisplay, unit);
    patchSet(set.id, { weight_kg: kg });
    const db = await getDatabase();
    await db.runAsync("UPDATE logged_sets SET weight_kg = ? WHERE id = ?", [kg, set.id]);
  }, [patchSet]);

  const handleRepsStepper = useCallback(async (set: LoggedSetRow, delta: number) => {
    const current = set.reps ?? 0;
    const next = Math.max(0, current + delta);
    const reps = next === 0 ? null : next;
    patchSet(set.id, { reps });
    const db = await getDatabase();
    await db.runAsync("UPDATE logged_sets SET reps = ? WHERE id = ?", [reps, set.id]);
  }, [patchSet]);

  const handleConfirm = useCallback(async (set: LoggedSetRow, exercise: LoggedExerciseRow, showWeight: boolean) => {
    const isConfirmed = set.is_confirmed === 1;
    const db = await getDatabase();
    if (isConfirmed) {
      patchSet(set.id, { is_confirmed: 0, completed_at: null });
      await db.runAsync("UPDATE logged_sets SET is_confirmed = 0, completed_at = NULL WHERE id = ?", [set.id]);
      return;
    }
    const repsValid = set.reps !== null && Number.isInteger(set.reps) && set.reps > 0;
    const needsWeight = exercise.is_bodyweight ? showWeight : true;
    const weightValid = needsWeight ? set.weight_kg !== null : true;
    const canConfirm = repsValid && (weightValid || (exercise.is_bodyweight === 1 && !showWeight));
    if (!canConfirm) {
      Alert.alert("Cannot confirm", "Set needs reps (positive integer) and weight if required.");
      return;
    }
    const completedAt = Date.now();
    patchSet(set.id, { is_confirmed: 1, completed_at: completedAt });
    await db.runAsync("UPDATE logged_sets SET is_confirmed = 1, completed_at = ? WHERE id = ?", [completedAt, set.id]);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (restEnabled) {
      setRestTimerEndsAt(Date.now() + restSeconds * 1000);
    }
  }, [patchSet, restEnabled, restSeconds, setRestTimerEndsAt]);

  const handleAddSet = useCallback(async (exerciseId: number) => {
    const db = await getDatabase();
    const maxRow = await db.getFirstAsync<{ maxNum: number | null }>("SELECT MAX(set_number) as maxNum FROM logged_sets WHERE logged_exercise_id = ?", [exerciseId]);
    const next = (maxRow?.maxNum ?? 0) + 1;
    await db.runAsync("INSERT INTO logged_sets (logged_exercise_id, set_number, weight_kg, reps, is_confirmed) VALUES (?, ?, ?, ?, 0)", [exerciseId, next, null, null]);
    await load();
  }, [load]);

  const handleDeleteSet = useCallback(async (setId: number) => {
    const db = await getDatabase();
    await db.runAsync("DELETE FROM logged_sets WHERE id = ?", [setId]);
    await load();
  }, [load]);

  const handleToggleUnit = useCallback(async (exerciseId: number, current: Unit) => {
    const next = toggleUnit(current);
    setExercises((prev) =>
      prev.map((item) =>
        item.exercise.id === exerciseId ? { ...item, exercise: { ...item.exercise, weight_unit: next } } : item
      )
    );
    const db = await getDatabase();
    await db.runAsync("UPDATE logged_exercises SET weight_unit = ? WHERE id = ?", [next, exerciseId]);
  }, []);

  const handleAddExercise = async () => {
    const name = newExerciseName.trim();
    if (!name) {
      Alert.alert("Invalid", "Exercise name cannot be empty");
      return;
    }
    if (logId === -1) {
      Alert.alert("Error", "No active workout");
      return;
    }
    const db = await getDatabase();
    const activeId = logId === -1 ? (await db.getFirstAsync<{ id: number }>("SELECT id FROM workout_logs WHERE status='active' LIMIT 1"))?.id : logId;
    if (!activeId) {
      Alert.alert("Error", "No active workout");
      return;
    }
    const maxRow = await db.getFirstAsync<{ maxPos: number | null }>("SELECT MAX(position) as maxPos FROM logged_exercises WHERE workout_log_id = ?", [activeId]);
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
      [activeId, name, newExerciseBW ? 1 : 0, nextPos, weightUnit]
    );
    const newId = res.lastInsertRowId;
    await db.runAsync("INSERT INTO logged_sets (logged_exercise_id, set_number, weight_kg, reps, is_confirmed) VALUES (?, ?, ?, ?, 0)", [newId, 1, null, null]);
    setNewExerciseName("");
    setNewExerciseBW(false);
    setShowAddExercise(false);
    await load();
  };

  const toggleShowWeight = useCallback((exerciseId: number) => {
    setShowWeightForBW((prev) => ({ ...prev, [exerciseId]: !prev[exerciseId] }));
  }, []);

  const getActiveId = async (): Promise<number | null> => {
    const db = await getDatabase();
    if (logId !== -1) return logId;
    const row = await db.getFirstAsync<{ id: number }>("SELECT id FROM workout_logs WHERE status = 'active' ORDER BY started_at DESC LIMIT 1");
    return row?.id ?? null;
  };

  const handleFinish = async () => {
    const db = await getDatabase();
    const id = await getActiveId();
    if (!id) return;
    const cntRow = await db.getFirstAsync<{ cnt: number }>(
      "SELECT COUNT(*) as cnt FROM logged_sets ls JOIN logged_exercises le ON ls.logged_exercise_id = le.id WHERE le.workout_log_id = ? AND ls.is_confirmed = 1",
      [id]
    );
    const confirmed = cntRow?.cnt ?? 0;
    if (confirmed === 0) {
      Alert.alert("No sets confirmed — discard this workout?", "", [
        {
          text: "Discard",
          style: "destructive",
          onPress: async () => {
            await db.runAsync("DELETE FROM workout_logs WHERE id = ?", [id]);
            clearWorkout();
            setRestTimerEndsAt(null);
            await hydrateWorkout();
            navigation.navigate("TrainHome");
          },
        },
        { text: "Keep training", style: "cancel" },
      ]);
      return;
    }
    await db.withTransactionAsync(async () => {
      await db.execAsync(`DELETE FROM logged_sets WHERE logged_exercise_id IN (SELECT id FROM logged_exercises WHERE workout_log_id = ${id}) AND is_confirmed = 0`);
      await db.execAsync(`DELETE FROM logged_exercises WHERE workout_log_id = ${id} AND id NOT IN (SELECT logged_exercise_id FROM logged_sets)`);
      await db.runAsync("UPDATE workout_logs SET finished_at = ?, status = 'completed' WHERE id = ?", [Date.now(), id]);
    });
    clearWorkout();
    setRestTimerEndsAt(null);
    await hydrateWorkout();
    navigation.navigate("TrainHome");
  };

  const handleDiscard = () => {
    Alert.alert("Discard workout?", "This will delete this workout and all its data.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Discard",
        style: "destructive",
        onPress: async () => {
          const db = await getDatabase();
          const id = await getActiveId();
          if (!id) return;
          await db.runAsync("DELETE FROM workout_logs WHERE id = ?", [id]);
          clearWorkout();
          setRestTimerEndsAt(null);
          await hydrateWorkout();
          navigation.navigate("TrainHome");
        },
      },
    ]);
  };

  const handleRestAdd15 = () => {
    const current = restEndsAt ?? Date.now();
    setRestTimerEndsAt(current + 15000);
  };
  const handleRestSkip = () => setRestTimerEndsAt(null);
  const handleRestDone = () => setRestTimerEndsAt(null);

  const contentPaddingBottom = useMemo(
    () => 120 + (showAddExercise ? keyboardHeight : 0),
    [showAddExercise, keyboardHeight]
  );

  if (!log) {
    return (
      <Screen>
        <Text style={{ color: theme.colors.textPrimary }}>Loading workout...</Text>
      </Screen>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, backgroundColor: theme.colors.bg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ color: theme.colors.textPrimary, fontSize: theme.typography.heading.fontSize, fontWeight: theme.typography.heading.fontWeight } as TextStyle}>{log.day_name_snapshot}</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8, flexShrink: 0 }}>
          <Button title="Finish" variant="primary" size="sm" onPress={handleFinish} />
          <Button title="Discard" variant="ghost" size="sm" onPress={handleDiscard} />
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={0}>
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: contentPaddingBottom }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          automaticallyAdjustKeyboardInsets
          nestedScrollEnabled={false}
          scrollEnabled={!scrollLocked}
        >
          {exercises.map((item) => (
            <ExerciseBlock
              key={item.exercise.id}
              item={item}
              fallbackUnit={fallbackUnit}
              restEnabled={restEnabled}
              showWeightForBW={!!showWeightForBW[item.exercise.id]}
              onLockScroll={lockScroll}
              onNotesBlur={handleNotesBlur}
              onWeightChange={handleWeightChange}
              onWeightStep={handleWeightStepper}
              onRepsChange={handleRepsChange}
              onRepsStep={handleRepsStepper}
              onConfirm={handleConfirm}
              onDeleteSet={handleDeleteSet}
              onAddSet={handleAddSet}
              onToggleExtraWeight={toggleShowWeight}
              onToggleUnit={handleToggleUnit}
            />
          ))}

          {showAddExercise ? (
            <Card style={{ gap: 8 }}>
              <TextInput
                value={newExerciseName}
                onChangeText={setNewExerciseName}
                placeholder="Exercise name"
                placeholderTextColor={theme.colors.textDisabled}
                autoFocus
                onFocus={() => {
                  setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
                }}
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
        </ScrollView>
      </KeyboardAvoidingView>
      {restEnabled && restEndsAt ? <RestTimerBar endsAt={restEndsAt} onAdd15={handleRestAdd15} onSkip={handleRestSkip} onDone={handleRestDone} /> : null}
    </View>
  );
}
