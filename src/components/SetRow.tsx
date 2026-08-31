import React from "react";
import { View, Text, Pressable, TextStyle } from "react-native";
import { useTheme } from "../theme/ThemeContext";
import { QuantityControl } from "./QuantityControl";
import { Button } from "./Button";
import type { Unit } from "../utils/units";

type Props = {
  setNumber: number;
  unit: Unit;
  displayWeight: number | null;
  reps: number | null;
  showWeight: boolean;
  isBodyweight: boolean;
  confirmed: boolean;
  showConfirm: boolean;
  restEnabled?: boolean;
  onWeightChange: (v: number | null) => void;
  onWeightStep: (delta: number) => void;
  onRepsChange: (v: number | null) => void;
  onRepsStep: (delta: number) => void;
  onConfirm?: () => void;
  onDelete: () => void;
  onToggleExtraWeight?: () => void;
  onUnitPress?: () => void;
  onLockScroll?: (locked: boolean) => void;
  weightStep: number;
};

function SetRowInner({
  setNumber,
  unit,
  displayWeight,
  reps,
  showWeight,
  isBodyweight,
  confirmed,
  showConfirm,
  restEnabled = false,
  onWeightChange,
  onWeightStep,
  onRepsChange,
  onRepsStep,
  onConfirm,
  onDelete,
  onToggleExtraWeight,
  onUnitPress,
  onLockScroll,
  weightStep,
}: Props) {
  const theme = useTheme();
  const { colors } = theme;
  const roundedWeight = displayWeight !== null ? Math.round(displayWeight * 10) / 10 : null;
  const confirmTitle = confirmed ? "Undo set" : restEnabled ? "Set done — start rest" : "Set done";

  return (
    <View
      style={{
        gap: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: colors.border,
      }}
    >
      <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "600", fontVariant: ["tabular-nums"] } as TextStyle}>
        Set {setNumber}
        {confirmed ? " · done" : ""}
      </Text>

      {isBodyweight && !showWeight ? (
        <View style={{ gap: 8 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 13 } as TextStyle}>Bodyweight</Text>
          <Button title="Add extra weight" variant="secondary" size="sm" fullWidth onPress={onToggleExtraWeight} />
        </View>
      ) : null}

      {showWeight ? (
        <View style={{ gap: 8 }}>
          <QuantityControl
            label={isBodyweight ? "Extra weight" : "Weight"}
            value={roundedWeight}
            onChange={onWeightChange}
            onIncrement={() => onWeightStep(weightStep)}
            onDecrement={() => onWeightStep(-weightStep)}
            unit={unit}
            onUnitPress={onUnitPress}
            placeholder="0"
            decimal
            accessibilityLabel={isBodyweight ? "Extra weight" : "Weight"}
            onLockScroll={onLockScroll}
          />
          {isBodyweight ? (
            <Button title="Hide extra weight" variant="ghost" size="sm" onPress={onToggleExtraWeight} />
          ) : null}
        </View>
      ) : null}

      <QuantityControl
        label="Reps"
        value={reps}
        onChange={onRepsChange}
        onIncrement={() => onRepsStep(1)}
        onDecrement={() => onRepsStep(-1)}
        placeholder="0"
        accessibilityLabel="Reps"
        onLockScroll={onLockScroll}
      />

      {showConfirm ? (
        <Button
          title={confirmTitle}
          variant={confirmed ? "secondary" : "primary"}
          fullWidth
          onPress={onConfirm}
          accessibilityLabel={confirmed ? "Undo set" : restEnabled ? "Set done, start rest timer" : "Set done"}
        />
      ) : null}

      <Pressable onPress={onDelete} accessibilityLabel="Remove set" accessibilityRole="button" hitSlop={8} style={{ alignSelf: "flex-start", paddingVertical: 4 }}>
        <Text style={{ color: colors.danger, fontSize: 13, fontWeight: "600" } as TextStyle}>Remove set</Text>
      </Pressable>
    </View>
  );
}

export const SetRow = React.memo(SetRowInner);
