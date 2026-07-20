import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { fmtPace, paceSecPerKm, Run } from '../engine/runs';
import { theme, mono } from '../theme';
import { Sheet } from './Sheet';

// Log or edit a run by hand. Health-imported runs come in via sync instead.
export function RunLog({
  visible,
  initial,
  onClose,
  onSave,
}: {
  visible: boolean;
  initial?: Run;
  onClose: () => void;
  onSave: (run: Run) => void;
}) {
  const [date, setDate] = useState('');
  const [km, setKm] = useState('');
  const [minutes, setMinutes] = useState('');

  useEffect(() => {
    if (!visible) return;
    setDate(initial?.date ?? new Date().toISOString().slice(0, 10));
    setKm(initial ? String(initial.distanceKm) : '');
    setMinutes(initial ? (initial.durationSec / 60).toFixed(0) : '');
  }, [visible, initial]);

  const kmNum = parseFloat(km);
  const minNum = parseFloat(minutes);
  const valid =
    /^\d{4}-\d{2}-\d{2}$/.test(date) && kmNum > 0 && kmNum < 200 && minNum > 0 && minNum < 600;

  const livePace =
    valid && kmNum > 0
      ? fmtPace(paceSecPerKm({ distanceKm: kmNum, durationSec: minNum * 60 }))
      : '—';

  const save = () => {
    if (!valid) return;
    onSave({
      id: initial?.id ?? `manual-run-${date}-${Math.random().toString(36).slice(2, 8)}`,
      date,
      distanceKm: Math.round(kmNum * 100) / 100,
      durationSec: Math.round(minNum * 60),
      source: initial?.source ?? 'manual',
      calories: initial?.calories,
      avgHrBpm: initial?.avgHrBpm,
    });
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={initial ? 'Edit run' : 'Log a run'}
      subtitle={
        initial ? undefined : 'Runs synced from Apple Health appear automatically — this is for the rest.'
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
        <View style={styles.inline}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Distance (km)</Text>
            <TextInput
              value={km}
              onChangeText={setKm}
              placeholder="5.0"
              placeholderTextColor={theme.textFaint}
              keyboardType="numeric"
              style={styles.input}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>Duration (min)</Text>
            <TextInput
              value={minutes}
              onChangeText={setMinutes}
              placeholder="30"
              placeholderTextColor={theme.textFaint}
              keyboardType="numeric"
              style={styles.input}
            />
          </View>
        </View>
        <Text style={styles.pace}>
          pace <Text style={mono}>{livePace}</Text>
        </Text>
      </View>
      <Pressable onPress={save} style={[styles.primaryBtn, !valid && { opacity: 0.4 }]}>
        <Text style={styles.primaryBtnText}>{initial ? 'Save changes' : 'Save run'}</Text>
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
    gap: 8,
    marginBottom: 12,
  },
  label: { color: theme.textDim, fontSize: 13, fontWeight: '600', marginBottom: 6 },
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
  inline: { flexDirection: 'row', gap: 10 },
  pace: { color: theme.textFaint, fontSize: 12.5, marginTop: 4 },
  primaryBtn: {
    backgroundColor: theme.accent,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryBtnText: { color: theme.onAccent, fontSize: 16, fontWeight: '700' },
});
