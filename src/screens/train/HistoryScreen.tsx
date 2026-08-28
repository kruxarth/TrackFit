import React, { useState, useCallback } from "react";
import { View, Text, TextStyle } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Screen } from "../../components/Screen";
import { Card } from "../../components/Card";
import { EmptyState } from "../../components/EmptyState";
import { useTheme } from "../../theme/ThemeContext";
import { getDatabase } from "../../db/database";
import { toLocalISO } from "../../utils/dates";
import type { TrainStackParamList } from "../../navigation/RootNavigator";

type Nav = NativeStackNavigationProp<TrainStackParamList>;

type HistoryRow = {
  id: number;
  day_name_snapshot: string;
  started_at: number;
  exerciseCount: number;
  confirmedSets: number;
  monthKey: string;
};

function monthHeader(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function monthKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function HistoryScreen() {
  const theme = useTheme();
  const navigation = useNavigation<Nav>();
  const [grouped, setGrouped] = useState<Record<string, HistoryRow[]>>({});
  const [orderedMonths, setOrderedMonths] = useState<string[]>([]);
  const [empty, setEmpty] = useState(false);

  const load = useCallback(async () => {
    const db = await getDatabase();
    const logs = await db.getAllAsync<{ id: number; day_name_snapshot: string; started_at: number }>("SELECT id, day_name_snapshot, started_at FROM workout_logs WHERE status = 'completed' ORDER BY started_at DESC");
    if (logs.length === 0) {
      setEmpty(true);
      setGrouped({});
      setOrderedMonths([]);
      return;
    }
    setEmpty(false);
    const rows: HistoryRow[] = [];
    for (const log of logs) {
      const exCnt = await db.getFirstAsync<{ cnt: number }>("SELECT COUNT(*) as cnt FROM logged_exercises WHERE workout_log_id = ?", [log.id]);
      const setCnt = await db.getFirstAsync<{ cnt: number }>("SELECT COUNT(*) as cnt FROM logged_sets ls JOIN logged_exercises le ON ls.logged_exercise_id = le.id WHERE le.workout_log_id = ? AND ls.is_confirmed = 1", [log.id]);
      rows.push({
        id: log.id,
        day_name_snapshot: log.day_name_snapshot,
        started_at: log.started_at,
        exerciseCount: exCnt?.cnt ?? 0,
        confirmedSets: setCnt?.cnt ?? 0,
        monthKey: monthKey(log.started_at),
      });
    }
    const g: Record<string, HistoryRow[]> = {};
    const order: string[] = [];
    for (const r of rows) {
      if (!g[r.monthKey]) {
        g[r.monthKey] = [];
        order.push(r.monthKey);
      }
      g[r.monthKey].push(r);
    }
    setGrouped(g);
    setOrderedMonths(order);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  if (empty) {
    return (
      <Screen>
        <EmptyState icon="time-outline" heading="No history yet" caption="Completed workouts will appear here" />
      </Screen>
    );
  }

  return (
    <Screen>
      {orderedMonths.map((mk) => {
        const rows = grouped[mk];
        const header = monthHeader(rows[0].started_at);
        return (
          <View key={mk} style={{ gap: 8 }}>
            <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize, marginTop: 8 } as TextStyle}>{header}</Text>
            {rows.map((r) => (
              <Card key={r.id} onPress={() => navigation.navigate("LogDetail", { logId: r.id })} style={{ gap: 4 }}>
                <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.heading.fontSize, fontWeight: theme.typography.heading.fontWeight } as TextStyle}>{r.day_name_snapshot}</Text>
                <Text style={{ color: theme.colors.textSecondary, fontSize: theme.typography.caption.fontSize } as TextStyle}>
                  {toLocalISO(r.started_at)} • {r.exerciseCount} {r.exerciseCount === 1 ? "exercise" : "exercises"} • {r.confirmedSets} {r.confirmedSets === 1 ? "set" : "sets"}
                </Text>
              </Card>
            ))}
          </View>
        );
      })}
    </Screen>
  );
}
