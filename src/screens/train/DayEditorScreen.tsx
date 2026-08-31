import React, { useState, useCallback, useRef } from "react";
import { View, Text, TextInput, Alert, Pressable, StyleSheet, TextStyle } from "react-native";
import { useRoute, useNavigation, RouteProp, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../components/Screen";
import { Card } from "../../components/Card";
import { Button } from "../../components/Button";
import { Stepper } from "../../components/Stepper";
import { EmptyState } from "../../components/EmptyState";
import { useTheme } from "../../theme/ThemeContext";
import * as daysRepo from "../../repos/daysRepo";
import type { TrainStackParamList } from "../../navigation/RootNavigator";

type Route = RouteProp<TrainStackParamList, "DayEditor">;
type Nav = NativeStackNavigationProp<TrainStackParamList>;

export function DayEditorScreen() {
  const theme = useTheme();
  const route = useRoute<Route>();
  const navigation = useNavigation<Nav>();
  const { dayId } = route.params;

  const [dayName, setDayName] = useState("");
  const [originalName, setOriginalName] = useState("");
  const [exercises, setExercises] = useState<daysRepo.DayExerciseRow[]>([]);
  const [newExerciseName, setNewExerciseName] = useState("");
  const [editingNew, setEditingNew] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const load = useCallback(async () => {
    const day = await daysRepo.getDayById(dayId);
    if (day) {
      setDayName(day.name);
      setOriginalName(day.name);
    }
    const ex = await daysRepo.getDayExercises(dayId);
    setExercises(ex);
  }, [dayId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const handleRename = async () => {
    const trimmed = dayName.trim();
    if (!trimmed) {
      setDayName(originalName);
      return;
    }
    if (trimmed !== originalName) {
      await daysRepo.updateDayName(dayId, trimmed);
      setOriginalName(trimmed);
    }
  };

  const handleAddExercise = async () => {
    const trimmed = newExerciseName.trim();
    if (!trimmed) {
      Alert.alert("Invalid name", "Exercise name cannot be empty or whitespace only");
      return;
    }
    try {
      await daysRepo.addDayExercise(dayId, trimmed);
      setNewExerciseName("");
      setEditingNew(false);
      await load();
    } catch (e) {
      Alert.alert("Error", String(e));
    }
  };

  const handleDeleteExercise = (id: number) => {
    Alert.alert("Delete exercise?", "This will remove the exercise from this Day. Past logs are unaffected.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await daysRepo.deleteDayExercise(id);
          await load();
        },
      },
    ]);
  };

  const handleMove = async (id: number, dir: "up" | "down") => {
    await daysRepo.moveDayExercise(dayId, id, dir);
    await load();
  };

  const handleTargetSetsChange = async (id: number, delta: number) => {
    const ex = exercises.find((e) => e.id === id);
    if (!ex) return;
    const next = Math.max(1, Math.min(10, ex.target_sets + delta));
    if (next !== ex.target_sets) {
      await daysRepo.updateDayExercise(id, { target_sets: next });
      await load();
    }
  };

  const handleBodyweightToggle = async (id: number) => {
    const ex = exercises.find((e) => e.id === id);
    if (!ex) return;
    await daysRepo.updateDayExercise(id, { is_bodyweight: ex.is_bodyweight ? 0 : 1 });
    await load();
  };

  const handleDeleteDay = () => {
    Alert.alert("Delete Day?", "This will delete the Day template. Past workout logs will be kept but will no longer be linked to this Day.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await daysRepo.deleteDay(dayId);
          navigation.goBack();
        },
      },
    ]);
  };

  const startEditingNew = () => {
    setEditingNew(true);
    setNewExerciseName("");
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  return (
    <Screen scrollToEndKey={editingNew}>
      <View style={{ gap: 8 }}>
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.caption.fontSize } as TextStyle}>Day name</Text>
        <TextInput
          value={dayName}
          onChangeText={setDayName}
          onBlur={handleRename}
          onSubmitEditing={handleRename}
          placeholder="Day name"
          placeholderTextColor={theme.colors.textDisabled}
          style={{
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: theme.colors.border,
            borderRadius: theme.radii.input,
            paddingHorizontal: 12,
            paddingVertical: 10,
            color: theme.colors.textPrimary,
            backgroundColor: theme.colors.surface,
            fontSize: 17,
            fontWeight: "600",
          }}
        />
      </View>

      <View style={{ gap: 8 }}>
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.heading.fontSize, fontWeight: theme.typography.heading.fontWeight } as TextStyle}>Exercises ({exercises.length})</Text>
        {exercises.length === 0 && !editingNew ? <EmptyState icon="barbell-outline" heading="No exercises yet" caption="Add your first exercise" /> : null}
        {exercises.map((ex, idx) => (
          <Card key={ex.id} style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.body.fontSize, fontWeight: "600" } as TextStyle}>{ex.name}</Text>
              <Pressable
                onPress={() => handleDeleteExercise(ex.id)}
                accessibilityLabel="Delete exercise"
                style={{ padding: 6 }}
              >
                <Ionicons name="trash-outline" size={18} color={theme.colors.danger} />
              </Pressable>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <Text style={{ color: theme.colors.textSecondary, fontSize: 13 } as TextStyle}>Sets</Text>
              <Stepper
                value={ex.target_sets}
                onIncrement={() => handleTargetSetsChange(ex.id, 1)}
                onDecrement={() => handleTargetSetsChange(ex.id, -1)}
              />
              <Pressable
                onPress={() => handleBodyweightToggle(ex.id)}
                accessibilityLabel="Toggle bodyweight"
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: theme.radii.pill,
                  backgroundColor: ex.is_bodyweight ? theme.colors.accent : theme.colors.surfaceRaised,
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: theme.colors.border,
                }}
              >
                <Ionicons name="body-outline" size={16} color={ex.is_bodyweight ? theme.colors.onAccent : theme.colors.textSecondary} />
                <Text style={{ color: ex.is_bodyweight ? theme.colors.onAccent : theme.colors.textSecondary, fontSize: 13, fontWeight: "600" } as TextStyle}>BW</Text>
              </Pressable>
            </View>

            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={() => handleMove(ex.id, "up")}
                disabled={idx === 0}
                style={{ opacity: idx === 0 ? 0.3 : 1, padding: 6 }}
                accessibilityLabel="Move up"
              >
                <Ionicons name="arrow-up" size={18} color={theme.colors.textPrimary} />
              </Pressable>
              <Pressable
                onPress={() => handleMove(ex.id, "down")}
                disabled={idx === exercises.length - 1}
                style={{ opacity: idx === exercises.length - 1 ? 0.3 : 1, padding: 6 }}
                accessibilityLabel="Move down"
              >
                <Ionicons name="arrow-down" size={18} color={theme.colors.textPrimary} />
              </Pressable>
            </View>
          </Card>
        ))}

        {editingNew ? (
          <Card style={{ gap: 8 }}>
            <TextInput
              ref={inputRef}
              value={newExerciseName}
              onChangeText={setNewExerciseName}
              placeholder="Exercise name"
              placeholderTextColor={theme.colors.textDisabled}
              autoFocus
              onSubmitEditing={handleAddExercise}
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
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Button title="Cancel" variant="secondary" onPress={() => { setEditingNew(false); setNewExerciseName(""); }} />
              </View>
              <View style={{ flex: 1 }}>
                <Button title="Add" variant="primary" onPress={handleAddExercise} />
              </View>
            </View>
          </Card>
        ) : (
          <Button title="+ Add exercise" variant="secondary" onPress={startEditingNew} />
        )}
      </View>

      <View style={{ marginTop: 24 }}>
        <Button title="Delete Day" variant="danger" onPress={handleDeleteDay} />
      </View>
    </Screen>
  );
}
