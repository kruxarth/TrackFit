import React, { useState, useCallback } from "react";
import { View, Text, TextInput, Alert, Pressable, StyleSheet, TextStyle } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Screen } from "../../components/Screen";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { AppModal } from "../../components/AppModal";
import { useTheme } from "../../theme/ThemeContext";
import * as daysRepo from "../../repos/daysRepo";
import { getDatabase } from "../../db/database";
import { toLocalISO } from "../../utils/dates";
import { startWorkout } from "../../services/startWorkout";
import { useWorkoutStore } from "../../stores/workoutStore";
import type { TrainStackParamList } from "../../navigation/RootNavigator";

type Nav = NativeStackNavigationProp<TrainStackParamList>;

type DayWithMeta = {
  id: number;
  name: string;
  position: number;
  created_at: number;
  exerciseCount: number;
  lastDone: string | null;
};

function formatLastDone(ms: number | null): string {
  if (ms === null) return "Never";
  const dateStr = toLocalISO(ms);
  const now = Date.now();
  const diff = now - ms;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return `Today • ${dateStr}`;
  if (days === 1) return `Yesterday • ${dateStr}`;
  if (days < 7) return `${days}d ago • ${dateStr}`;
  if (days < 30) return `${Math.floor(days / 7)}w ago • ${dateStr}`;
  return dateStr;
}

export function TrainHomeScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const [days, setDays] = useState<DayWithMeta[]>([]);
  const [newDayName, setNewDayName] = useState("New Day");
  const [showNewDay, setShowNewDay] = useState(false);
  const [pickedDay, setPickedDay] = useState<DayWithMeta | null>(null);
  const [activeConflictId, setActiveConflictId] = useState<number | null>(null);
  const [activeLog, setActiveLog] = useState<{ id: number; day_name_snapshot: string; started_at: number } | null>(null);
  const [recent, setRecent] = useState<{ id: number; day_name_snapshot: string; started_at: number; exerciseCount: number; confirmedSets: number }[]>([]);

  const load = useCallback(async () => {
    const all = await daysRepo.getDays();
    const db = await getDatabase();
    const enriched: DayWithMeta[] = [];
    for (const d of all) {
      const exCountRow = await db.getFirstAsync<{ cnt: number }>("SELECT COUNT(*) as cnt FROM day_exercises WHERE day_id = ?", [d.id]);
      const exerciseCount = exCountRow?.cnt ?? 0;
      const lastRow = await db.getFirstAsync<{ started_at: number }>("SELECT started_at FROM workout_logs WHERE day_id = ? AND status = 'completed' ORDER BY started_at DESC LIMIT 1", [d.id]);
      const lastDone = lastRow ? formatLastDone(lastRow.started_at) : null;
      enriched.push({ ...d, exerciseCount, lastDone });
    }
    setDays(enriched);
    const active = await db.getFirstAsync<{ id: number; day_name_snapshot: string; started_at: number }>("SELECT id, day_name_snapshot, started_at FROM workout_logs WHERE status = 'active' ORDER BY started_at DESC LIMIT 1");
    setActiveLog(active ?? null);
    const recentRows = await db.getAllAsync<{ id: number; day_name_snapshot: string; started_at: number }>("SELECT id, day_name_snapshot, started_at FROM workout_logs WHERE status = 'completed' ORDER BY started_at DESC LIMIT 3");
    const recentEnriched: typeof recent = [];
    for (const r of recentRows) {
      const exCnt = await db.getFirstAsync<{ cnt: number }>("SELECT COUNT(*) as cnt FROM logged_exercises WHERE workout_log_id = ?", [r.id]);
      const setCnt = await db.getFirstAsync<{ cnt: number }>("SELECT COUNT(*) as cnt FROM logged_sets ls JOIN logged_exercises le ON ls.logged_exercise_id = le.id WHERE le.workout_log_id = ? AND ls.is_confirmed = 1", [r.id]);
      recentEnriched.push({ id: r.id, day_name_snapshot: r.day_name_snapshot, started_at: r.started_at, exerciseCount: exCnt?.cnt ?? 0, confirmedSets: setCnt?.cnt ?? 0 });
    }
    setRecent(recentEnriched);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const handleCreateDay = async () => {
    const name = newDayName.trim() || "New Day";
    try {
      const day = await daysRepo.createDay(name);
      setShowNewDay(false);
      setNewDayName("New Day");
      navigation.navigate("DayEditor", { dayId: day.id });
    } catch (e) {
      Alert.alert("Error", String(e));
    }
  };

  const beginWorkout = async (day: DayWithMeta) => {
    try {
      const db = await getDatabase();
      const active = await db.getFirstAsync<{ id: number }>("SELECT id FROM workout_logs WHERE status = 'active' LIMIT 1");
      if (active) {
        setPickedDay(null);
        setActiveConflictId(active.id);
        return;
      }
      const logId = await startWorkout(day.id);
      const store = useWorkoutStore.getState();
      store.setActiveLogId(logId);
      await store.hydrate();
      setPickedDay(null);
      navigation.navigate("Workout", { logId });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("active workout")) {
        const db = await getDatabase();
        const active = await db.getFirstAsync<{ id: number }>("SELECT id FROM workout_logs WHERE status = 'active' LIMIT 1");
        if (active) {
          setPickedDay(null);
          setActiveConflictId(active.id);
          return;
        }
      }
      Alert.alert("Error", msg);
    }
  };

  return (
    <Screen>
      {activeLog ? (
        <Card style={{ borderColor: theme.colors.accent, borderWidth: 1.5, gap: 8 }}>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.heading.fontSize, fontWeight: theme.typography.heading.fontWeight } as TextStyle}>Workout in progress</Text>
          <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.body.fontSize } as TextStyle}>{activeLog.day_name_snapshot}</Text>
          <Button title="Resume" variant="primary" onPress={() => navigation.navigate("Workout", { logId: activeLog.id })} />
        </Card>
      ) : null}
      <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.title.fontSize, fontWeight: theme.typography.title.fontWeight }}>Days</Text>
      {days.length === 0 ? (
        <EmptyState
          icon="barbell-outline"
          heading="No Days yet"
          caption="Create your first Day to get started"
          buttonTitle="Create your first Day"
          onButtonPress={() => setShowNewDay(true)}
        />
      ) : (
        <>
          {days.map((d) => (
            <Card key={d.id} onPress={() => setPickedDay(d)} style={{ gap: 4 }}>
              <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.heading.fontSize, fontWeight: theme.typography.heading.fontWeight } as TextStyle}>{d.name}</Text>
              <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize } as TextStyle}>
                {d.exerciseCount} {d.exerciseCount === 1 ? "exercise" : "exercises"}
                {d.lastDone ? ` • Last done: ${d.lastDone}` : " • Never done"}
              </Text>
            </Card>
          ))}
        </>
      )}

      {showNewDay ? (
        <Card>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.heading.fontSize, fontWeight: theme.typography.heading.fontWeight } as TextStyle}>New Day</Text>
          <TextInput
            value={newDayName}
            onChangeText={setNewDayName}
            placeholder="Day name"
            placeholderTextColor={theme.colors.textDisabled}
            autoFocus
            style={{
              marginTop: 8,
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
          <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
            <View style={{ flex: 1 }}>
              <Button title="Cancel" variant="secondary" onPress={() => setShowNewDay(false)} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title="Create" variant="primary" onPress={handleCreateDay} />
            </View>
          </View>
        </Card>
      ) : (
        <Button title="+ New Day" variant="primary" onPress={() => setShowNewDay(true)} />
      )}

      {recent.length > 0 ? (
        <View style={{ gap: 8 }}>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.heading.fontSize, fontWeight: theme.typography.heading.fontWeight } as TextStyle}>Recent</Text>
          {recent.map((r) => (
            <Card key={r.id} onPress={() => navigation.navigate("LogDetail", { logId: r.id })} style={{ gap: 4 }}>
              <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.body.fontSize, fontWeight: "600" } as TextStyle}>{r.day_name_snapshot}</Text>
              <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize } as TextStyle}>
                {toLocalISO(r.started_at)} • {r.exerciseCount} {r.exerciseCount === 1 ? "exercise" : "exercises"} • {r.confirmedSets} {r.confirmedSets === 1 ? "set" : "sets"}
              </Text>
            </Card>
          ))}
          <Pressable onPress={() => navigation.navigate("History")} style={{ paddingVertical: 4 }}>
            <Text style={{ color: theme.colors.accent, fontSize: 14, fontWeight: "600" } as TextStyle}>View all history →</Text>
          </Pressable>
        </View>
      ) : null}
      <View style={{ height: 16 }} />
      <AppModal
        visible={pickedDay !== null}
        title={pickedDay?.name ?? "Day"}
        message="Start this workout, or edit the day template."
        onClose={() => setPickedDay(null)}
        actions={[
          {
            title: "Start workout",
            onPress: () => {
              if (pickedDay) void beginWorkout(pickedDay);
            },
          },
          {
            title: "Edit day",
            variant: "secondary",
            onPress: () => {
              if (!pickedDay) return;
              const dayId = pickedDay.id;
              setPickedDay(null);
              navigation.navigate("DayEditor", { dayId });
            },
          },
          {
            title: "Cancel",
            variant: "ghost",
            onPress: () => setPickedDay(null),
          },
        ]}
      />
      <AppModal
        visible={activeConflictId !== null}
        title="Workout already in progress"
        message="Finish or discard the current session before starting another day."
        onClose={() => setActiveConflictId(null)}
        actions={[
          {
            title: "Resume",
            onPress: () => {
              if (activeConflictId === null) return;
              const logId = activeConflictId;
              setActiveConflictId(null);
              navigation.navigate("Workout", { logId });
            },
          },
          {
            title: "Cancel",
            variant: "ghost",
            onPress: () => setActiveConflictId(null),
          },
        ]}
      />
    </Screen>
  );
}
