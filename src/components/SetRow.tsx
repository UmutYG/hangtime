import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PlannedSet } from '../engine/types';
import { theme, mono } from '../theme';

export function SetRow({
  set,
  index,
  state,
  actualReps,
  onComplete,
  onAdjust,
}: {
  set: PlannedSet;
  index: number;
  state: 'done' | 'current' | 'upcoming';
  actualReps: number | null;
  onComplete: () => void;
  onAdjust: (delta: number) => void;
}) {
  const isDone = state === 'done';
  const isCurrent = state === 'current';
  const label = set.isWarmup
    ? 'Warm-up'
    : set.ladder
      ? `Ladder ${set.ladder.ladderIndex} · rung ${set.ladder.rung}`
      : `Set ${index}`;
  const loadText = set.loadKg > 0 ? `+${set.loadKg} kg` : 'BW';
  const repsText = set.amrap ? `${set.targetReps}+` : `${set.targetReps}`;

  return (
    <View style={[styles.row, isCurrent && styles.current, isDone && styles.done]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.label, isDone && styles.dimText]}>{label}</Text>
        <Text style={[styles.target, isDone && styles.dimText]}>
          <Text style={mono}>{repsText}</Text> reps · {loadText}
          {set.amrap ? '  (max)' : ''}
        </Text>
        {set.note && isCurrent ? <Text style={styles.note}>{set.note}</Text> : null}
      </View>
      {isDone ? (
        <View style={styles.stepper}>
          <Pressable onPress={() => onAdjust(-1)} style={styles.stepBtn} hitSlop={8}>
            <Text style={styles.stepText}>−</Text>
          </Pressable>
          <Text style={[styles.doneReps, mono]}>{actualReps}</Text>
          <Pressable onPress={() => onAdjust(1)} style={styles.stepBtn} hitSlop={8}>
            <Text style={styles.stepText}>+</Text>
          </Pressable>
        </View>
      ) : isCurrent ? (
        <Pressable onPress={onComplete} style={styles.doBtn}>
          <Text style={styles.doBtnText}>Done</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 14,
    gap: 10,
  },
  current: { borderColor: theme.accent, backgroundColor: theme.cardRaised },
  done: { opacity: 0.75 },
  label: { color: theme.textDim, fontSize: 11, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase' },
  target: { color: theme.text, fontSize: 17, fontWeight: '600', marginTop: 2 },
  note: { color: theme.textDim, fontSize: 12, marginTop: 4, lineHeight: 17 },
  dimText: { color: theme.textFaint },
  doBtn: {
    backgroundColor: theme.accent,
    borderRadius: 10,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  doBtnText: { color: theme.onAccent, fontWeight: '700', fontSize: 15 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: theme.cardRaised,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { color: theme.text, fontSize: 16, fontWeight: '700' },
  doneReps: { color: theme.good, fontSize: 18, fontWeight: '700', minWidth: 26, textAlign: 'center' },
});
