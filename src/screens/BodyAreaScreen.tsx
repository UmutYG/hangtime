import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { computeReadiness, Modality } from '../engine/load';
import { generateSession } from '../engine/generator';
import { generatePushSession } from '../engine/pushups';
import { runStats } from '../engine/runs';
import { workoutMode } from '../engine/activeWorkout';
import { useStore } from '../hooks/useStore';
import { useWorkout } from '../hooks/useWorkout';
import { useJointFeel, useLoadEntries } from '../hooks/useReadiness';
import { useNav } from '../hooks/useNav';
import { AppMode, mono, theme, type } from '../theme';
import { ModeMark } from '../components/ModeMark';
import { RoofBar } from '../components/RoofBar';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const TRAINING: Array<{ key: Modality; mode: AppMode; name: string; color: string }> = [
  { key: 'pull', mode: 'pullups', name: 'Pull-ups', color: theme.accent },
  { key: 'push', mode: 'pushups', name: 'Push-ups', color: theme.push },
  { key: 'run', mode: 'running', name: 'Running', color: theme.run },
];

const LEVEL_LABEL: Record<string, string> = {
  fresh: 'Fresh',
  ready: 'Ready',
  moderate: 'Some fatigue',
  fatigued: 'Fatigued',
};

/** The Body area — three training spaces sharing one recovery budget. */
export function BodyAreaScreen() {
  const { store } = useStore();
  const { go } = useNav();
  const workout = useWorkout();
  const entries = useLoadEntries();
  const joints = useJointFeel();
  const today = todayIso();
  const runS = runStats(store.runs, today);
  const pendingMode = workout.pending ? workoutMode(workout.pending) : null;

  const rows = useMemo(
    () =>
      TRAINING.map((m) => {
        // joints included, same as inside each space — an area page that
        // disagrees with the room it opens is worse than no number at all
        const readiness = computeReadiness(
          m.key,
          entries,
          today,
          store.externalReadiness ?? null,
          joints
        );
        let plan = '—';
        let done = false;
        if (m.key === 'pull') {
          plan = store.profile
            ? generateSession(store.profile, store.state, today).title
            : 'Not set up yet';
          done = store.sessions.some((s) => s.date === today && s.dayKind !== 'custom');
        } else if (m.key === 'push') {
          plan = store.pushState
            ? generatePushSession(store.pushState, undefined, today).title
            : 'Not set up yet';
          done = store.pushSessions.some((s) => s.date === today && s.dayKind !== 'pushCustom');
        } else {
          plan = `${runS.thisWeekKm} km this week`;
          done = store.runs.some((r) => r.date === today);
        }
        return { ...m, readiness, plan, done };
      }),
    [entries, today, store, runS.thisWeekKm, joints]
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <RoofBar />
      <View style={styles.headerRow}>
        <ModeMark mode="body" size={22} color={theme.accent} />
        <Text style={type.hero}>Body</Text>
      </View>

      {rows.map((r) => (
        <Pressable key={r.key} onPress={() => go(r.mode)} style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.nameRow}>
              <ModeMark mode={r.mode} size={18} color={r.color} />
              <Text style={styles.name}>{r.name}</Text>
              {pendingMode === r.mode ? (
                <View style={[styles.resumeChip, { borderColor: r.color }]}>
                  <Text style={[styles.resumeText, { color: r.color }]}>paused session</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.readinessScore, mono]}>{r.readiness.score}</Text>
          </View>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                { width: `${Math.max(4, r.readiness.score)}%`, backgroundColor: r.color },
              ]}
            />
          </View>
          <Text style={styles.meta}>
            {LEVEL_LABEL[r.readiness.level]}
            {r.done ? ' · done today ✓' : ''} — {r.plan}
          </Text>
        </Pressable>
      ))}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: theme.pad, gap: 12, paddingBottom: 50 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  card: {
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: theme.radiusLg,
    padding: 16,
    gap: 8,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 16, fontWeight: '700', color: theme.text },
  resumeChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 2,
  },
  resumeText: { fontSize: 10.5, fontWeight: '700' },
  readinessScore: { fontSize: 16, fontWeight: '600', color: theme.textDim },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: theme.cardMuted, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  meta: { fontSize: 13, color: theme.text, fontWeight: '600' },
});
