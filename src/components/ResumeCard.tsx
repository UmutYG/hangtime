import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ActiveWorkout, workoutProgress } from '../engine/activeWorkout';
import { DAY_TITLE } from '../lib/dayLabels';
import { theme } from '../theme';

// An interrupted session, offered — never auto-opened.
export function ResumeCard({
  workout,
  accent,
  onResume,
  onDiscard,
}: {
  workout: ActiveWorkout;
  accent: string;
  onResume: () => void;
  onDiscard: () => void;
}) {
  const { logged, total } = workoutProgress(workout);
  const when = new Date(workout.startedAt);
  const dateLabel = when.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const timeLabel = when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  return (
    <View style={[styles.card, { borderColor: accent }]}>
      <Text style={[styles.kicker, { color: accent }]}>UNFINISHED SESSION</Text>
      <Text style={styles.title}>{DAY_TITLE[workout.plan.dayKind] ?? workout.plan.dayKind}</Text>
      <Text style={styles.meta}>
        {dateLabel} at {timeLabel} · {logged} of {total} sets logged
      </Text>
      <View style={styles.btnRow}>
        <Pressable onPress={onResume} style={[styles.resumeBtn, { backgroundColor: accent }]}>
          <Text style={styles.resumeText}>Resume</Text>
        </Pressable>
        <Pressable onPress={onDiscard} style={styles.discardBtn} hitSlop={6}>
          <Text style={styles.discardText}>Discard</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.card,
    borderWidth: 1,
    borderRadius: theme.radiusLg,
    padding: 18,
    gap: 4,
  },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  title: { fontSize: 17, fontWeight: '700', color: theme.text, marginTop: 4 },
  meta: { fontSize: 12.5, color: theme.textFaint, marginTop: 2 },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 },
  resumeBtn: { flex: 1, borderRadius: 999, paddingVertical: 13, alignItems: 'center' },
  resumeText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  discardBtn: { paddingHorizontal: 12, paddingVertical: 12 },
  discardText: { color: theme.textFaint, fontSize: 13.5 },
});
