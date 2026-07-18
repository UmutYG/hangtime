import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LoggedSession } from '../engine/types';
import { theme, mono } from '../theme';

interface Row {
  reps: string;
  loadKg: string;
}

// Log a workout done outside the app (e.g. today's own session).
// Feeds the algorithm's estimates; never advances the program schedule.
export function ManualLog({
  defaultLoadKg,
  onSave,
  onCancel,
}: {
  defaultLoadKg: number;
  onSave: (session: LoggedSession) => void;
  onCancel: () => void;
}) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<Row[]>([{ reps: '', loadKg: '0' }]);

  const setRow = (i: number, patch: Partial<Row>) =>
    setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));

  const parsed = rows
    .map((r) => ({ reps: parseInt(r.reps, 10), loadKg: parseFloat(r.loadKg) || 0 }))
    .filter((r) => r.reps > 0);
  const valid = parsed.length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(date);

  const save = () => {
    if (!valid) return;
    onSave({
      id: `manual-${date}-${Math.random().toString(36).slice(2, 8)}`,
      date,
      dayKind: 'custom',
      cycle: 0,
      week: 0,
      sets: parsed.map((r) => ({ targetReps: r.reps, actualReps: r.reps, loadKg: r.loadKg })),
    });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Log your own workout</Text>
      <Text style={styles.sub}>
        Counts toward your stats and tunes the program's estimates. It won't replace a planned
        session.
      </Text>

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
        <Text style={styles.primaryBtnText}>Save workout</Text>
      </Pressable>
      <Pressable onPress={onCancel} style={styles.cancel}>
        <Text style={styles.cancelText}>Cancel</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  content: { padding: theme.pad, gap: 12, paddingBottom: 40 },
  title: { color: theme.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  sub: { color: theme.textDim, fontSize: 13, lineHeight: 19, marginTop: -6 },
  card: {
    backgroundColor: theme.card,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 14,
    gap: 10,
  },
  label: { color: theme.textDim, fontSize: 13, fontWeight: '600' },
  input: {
    backgroundColor: theme.cardRaised,
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
    backgroundColor: theme.cardRaised,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  smallBtnText: { color: theme.text, fontSize: 13, fontWeight: '600' },
  primaryBtn: {
    backgroundColor: theme.accent,
    borderRadius: theme.radius,
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryBtnText: { color: theme.onAccent, fontSize: 16, fontWeight: '800' },
  cancel: { alignItems: 'center', paddingVertical: 10 },
  cancelText: { color: theme.textFaint, fontSize: 13 },
});
