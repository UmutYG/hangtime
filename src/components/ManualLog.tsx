import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { LoggedSession } from '../engine/types';
import { theme, mono } from '../theme';
import { Sheet } from './Sheet';

interface Row {
  reps: string;
  loadKg: string;
}

// Log a workout done outside the app, or edit a past one. Feeds the
// algorithm's estimates; a fresh log never advances the program schedule.
export function ManualLog({
  visible,
  defaultLoadKg,
  initial,
  onClose,
  onSave,
}: {
  visible: boolean;
  defaultLoadKg: number;
  /** pass an existing session to edit it instead of creating a new one */
  initial?: LoggedSession;
  onClose: () => void;
  onSave: (session: LoggedSession) => void;
}) {
  const [date, setDate] = useState('');
  const [rows, setRows] = useState<Row[]>([]);

  // The sheet stays mounted while hidden, so the form must re-seed itself
  // from `initial` every time it opens — not just on first mount.
  useEffect(() => {
    if (!visible) return;
    setDate(initial?.date ?? new Date().toISOString().slice(0, 10));
    setRows(
      initial
        ? initial.sets
            .filter((s) => !s.isWarmup)
            .map((s) => ({ reps: String(s.actualReps), loadKg: String(s.loadKg) }))
        : [{ reps: '', loadKg: '0' }]
    );
  }, [visible, initial]);

  const setRow = (i: number, patch: Partial<Row>) =>
    setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));

  const parsed = rows
    .map((r) => ({ reps: parseInt(r.reps, 10), loadKg: parseFloat(r.loadKg) || 0 }))
    .filter((r) => r.reps > 0);
  const valid = parsed.length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(date);

  const save = () => {
    if (!valid) return;
    // Editing keeps the session's identity (dayKind, cycle position, effort,
    // warm-up sets) — otherwise replaying history would rewind the schedule.
    const warmups = initial?.sets.filter((s) => s.isWarmup) ?? [];
    onSave({
      ...(initial ?? {}),
      id: initial?.id ?? `manual-${date}-${Math.random().toString(36).slice(2, 8)}`,
      date,
      dayKind: initial?.dayKind ?? 'custom',
      cycle: initial?.cycle ?? 0,
      week: initial?.week ?? 0,
      sets: [
        ...warmups,
        ...parsed.map((r) => ({ targetReps: r.reps, actualReps: r.reps, loadKg: r.loadKg })),
      ],
    });
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={initial ? 'Edit workout' : 'Log a session'}
      subtitle={
        initial
          ? 'Changing sets recalculates all your stats and estimates.'
          : "Done outside the app — it still feeds the engine. Won't replace a planned session."
      }
    >
      <View style={styles.card}>
        <Text style={styles.label}>Date</Text>
        <TextInput
          value={date}
          onChangeText={setDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={theme.textFaint}
          style={styles.input}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Sets — reps and added load (0 = bodyweight)</Text>
        {rows.map((r, i) => (
          <View key={i} style={styles.row}>
            <Text style={[styles.rowNum, mono]}>{i + 1}</Text>
            <TextInput
              value={r.reps}
              onChangeText={(t) => setRow(i, { reps: t })}
              placeholder="reps"
              placeholderTextColor={theme.textFaint}
              keyboardType="numeric"
              style={[styles.input, { flex: 1 }]}
            />
            <TextInput
              value={r.loadKg}
              onChangeText={(t) => setRow(i, { loadKg: t })}
              placeholder="+kg"
              placeholderTextColor={theme.textFaint}
              keyboardType="numeric"
              style={[styles.input, { flex: 1 }]}
            />
            {rows.length > 1 ? (
              <Pressable onPress={() => setRows((rr) => rr.filter((_, j) => j !== i))} hitSlop={8}>
                <Text style={styles.remove}>✕</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
        <View style={styles.rowBtns}>
          <Pressable
            onPress={() => setRows((r) => [...r, { reps: '', loadKg: '0' }])}
            style={styles.smallBtn}
          >
            <Text style={styles.smallBtnText}>+ set</Text>
          </Pressable>
          <Pressable
            onPress={() => setRows((r) => [...r, { reps: '', loadKg: String(defaultLoadKg) }])}
            style={styles.smallBtn}
          >
            <Text style={styles.smallBtnText}>+ vest set ({defaultLoadKg} kg)</Text>
          </Pressable>
        </View>
      </View>

      <Pressable onPress={save} style={[styles.primaryBtn, !valid && { opacity: 0.4 }]}>
        <Text style={styles.primaryBtnText}>{initial ? 'Save changes' : 'Save to history'}</Text>
      </Pressable>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.card,
    borderRadius: theme.radiusLg,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 14,
    gap: 10,
    marginBottom: 12,
  },
  label: { color: theme.textDim, fontSize: 13, fontWeight: '600' },
  input: {
    backgroundColor: theme.cardMuted,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    color: theme.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowNum: { color: theme.textFaint, fontSize: 13, width: 18, textAlign: 'center' },
  remove: { color: theme.danger, fontSize: 16, paddingHorizontal: 4 },
  rowBtns: { flexDirection: 'row', gap: 8 },
  smallBtn: {
    backgroundColor: theme.cardMuted,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  smallBtnText: { color: theme.text, fontSize: 13, fontWeight: '600' },
  primaryBtn: {
    backgroundColor: theme.accent,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryBtnText: { color: theme.onAccent, fontSize: 16, fontWeight: '700' },
});
