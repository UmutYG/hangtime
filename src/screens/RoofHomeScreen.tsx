import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { computeReadiness, Modality } from '../engine/load';
import { nowWindow, supDayFor } from '../engine/supplements';
import { workoutMode } from '../engine/activeWorkout';
import { getEvents } from '../mind/lib/events';
import { loadSettings as loadMindSettings } from '../mind/lib/settings';
import { useStore } from '../hooks/useStore';
import { useWorkout } from '../hooks/useWorkout';
import { useLoadEntries } from '../hooks/useReadiness';
import { useNav } from '../hooks/useNav';
import { BRAND, mono, theme, type } from '../theme';
import { ModeMark } from '../components/ModeMark';
import { SettingsSheet } from '../components/SettingsSheet';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
function todayLabel(): string {
  return new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

/** The map of the life under this roof — one card per area, one glance each.
 *  Areas are rooms: Body holds the training spaces, Mind is the Slide practice,
 *  Supplements is the protocol. A future area (budget, anything) is one more card. */
export function RoofHomeScreen() {
  const { store } = useStore();
  const { go } = useNav();
  const workout = useWorkout();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const entries = useLoadEntries();
  const today = todayIso();

  // ——— Body: the three training spaces compressed to one line each ———
  const bodyRows = useMemo(() => {
    const spaces: Array<{ key: Modality; label: string; color: string }> = [
      { key: 'pull', label: 'Pull', color: theme.accent },
      { key: 'push', label: 'Push', color: theme.push },
      { key: 'run', label: 'Run', color: theme.run },
    ];
    return spaces.map((s) => ({
      ...s,
      score: computeReadiness(s.key, entries, today, store.externalReadiness ?? null).score,
    }));
  }, [entries, today, store.externalReadiness]);
  const minReadiness = Math.min(...bodyRows.map((r) => r.score));
  const trainedToday =
    (store.sessions.some((s) => s.date === today && s.dayKind !== 'custom') ? 1 : 0) +
    (store.pushSessions.some((s) => s.date === today && s.dayKind !== 'pushCustom') ? 1 : 0) +
    (store.runs.some((r) => r.date === today) ? 1 : 0);
  const hasPending = workout.pending ? workoutMode(workout.pending) : null;

  // ——— Mind: today's noticed signs + the vision wall, read from the module ———
  const [mindLine, setMindLine] = useState<{ signsToday: number; visions: number } | null>(null);
  useEffect(() => {
    let alive = true;
    Promise.all([getEvents(), loadMindSettings()]).then(([events, ms]) => {
      if (!alive) return;
      setMindLine({
        signsToday: events.filter((e) => e.date === today).length,
        visions: ms.visionCards.length,
      });
    });
    return () => {
      alive = false;
    };
  }, [today]);

  // ——— Supplements ———
  const activeItems = (store.supItems ?? []).filter((i) => i.active);
  const takenToday = Object.keys(supDayFor(store.supDays ?? [], today).taken).filter((id) =>
    activeItems.some((i) => i.id === id)
  ).length;
  const now = new Date();
  const nowLine = nowWindow(now.getHours() + now.getMinutes() / 60);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.dateLabel}>{todayLabel()}</Text>
          <Text style={type.hero}>{BRAND}</Text>
        </View>
        <Pressable onPress={() => setSettingsOpen(true)} style={styles.gearBtn} hitSlop={10}>
          <Text style={styles.gearIcon}>⚙</Text>
        </Pressable>
      </View>
      <Text style={styles.sub}>Everything you tend, under one roof.</Text>

      {/* ——— BODY ——— */}
      <Pressable onPress={() => go('body')} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.nameRow}>
            <ModeMark mode="body" size={19} color={theme.accent} />
            <Text style={styles.name}>Body</Text>
            {hasPending ? (
              <View style={[styles.resumeChip, { borderColor: theme.accent }]}>
                <Text style={[styles.resumeText, { color: theme.accent }]}>paused session</Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.scoreText, mono]}>{minReadiness}</Text>
        </View>
        <View style={styles.barTrack}>
          <View
            style={[
              styles.barFill,
              { width: `${Math.max(4, minReadiness)}%`, backgroundColor: theme.accent },
            ]}
          />
        </View>
        <Text style={styles.meta}>
          {trainedToday > 0
            ? `${trainedToday} session${trainedToday === 1 ? '' : 's'} today ✓`
            : 'Nothing trained yet today'}
        </Text>
        <View style={styles.miniRow}>
          {bodyRows.map((r) => (
            <View key={r.key} style={styles.miniItem}>
              <View style={[styles.miniDot, { backgroundColor: r.color }]} />
              <Text style={styles.miniText}>
                {r.label} <Text style={mono}>{r.score}</Text>
              </Text>
            </View>
          ))}
        </View>
      </Pressable>

      {/* ——— MIND ——— */}
      <Pressable onPress={() => go('mind')} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.nameRow}>
            <ModeMark mode="mind" size={18} color={theme.mind} />
            <Text style={styles.name}>Mind</Text>
          </View>
          <Text style={[styles.scoreText, mono]}>{mindLine ? mindLine.signsToday : '—'}</Text>
        </View>
        <Text style={styles.meta}>
          {mindLine === null
            ? ' '
            : mindLine.signsToday > 0
              ? `${mindLine.signsToday} sign${mindLine.signsToday === 1 ? '' : 's'} noticed today`
              : 'No signs noticed yet today'}
        </Text>
        <Text style={styles.reason}>
          {mindLine && mindLine.visions > 0
            ? `${mindLine.visions} vision${mindLine.visions === 1 ? '' : 's'} on the wall`
            : 'The vision wall is waiting'}
        </Text>
      </Pressable>

      {/* ——— SUPPLEMENTS ——— */}
      <Pressable onPress={() => go('supplements')} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.nameRow}>
            <ModeMark mode="supplements" size={18} color={theme.supp} />
            <Text style={styles.name}>Supplements</Text>
          </View>
          <Text style={[styles.scoreText, mono]}>
            {takenToday}/{activeItems.length}
          </Text>
        </View>
        <View style={styles.barTrack}>
          <View
            style={[
              styles.barFill,
              {
                width: `${activeItems.length ? Math.max(4, (takenToday / activeItems.length) * 100) : 4}%`,
                backgroundColor: theme.supp,
              },
            ]}
          />
        </View>
        <Text style={styles.meta}>
          {takenToday === activeItems.length && activeItems.length > 0
            ? 'All logged today ✓'
            : `${takenToday} of ${activeItems.length} logged today`}
        </Text>
        <Text style={styles.reason}>{nowLine.state}</Text>
      </Pressable>

      <Text style={styles.footNote}>
        A new area of life becomes a new room here — nothing more, nothing sooner.
      </Text>

      <SettingsSheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: theme.pad, gap: 12, paddingBottom: 50 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  dateLabel: { color: theme.textFaint, fontSize: 13, fontWeight: '500' },
  gearBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearIcon: { fontSize: 16, color: theme.textDim },
  sub: { color: theme.textDim, fontSize: 13, lineHeight: 19.5, marginTop: -4, marginBottom: 4 },
  card: {
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: theme.radiusLg,
    padding: 16,
    gap: 8,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  name: { fontSize: 16.5, fontWeight: '700', color: theme.text },
  resumeChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 2,
  },
  resumeText: { fontSize: 10.5, fontWeight: '700' },
  scoreText: { fontSize: 16, fontWeight: '600', color: theme.textDim },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: theme.cardMuted, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  meta: { fontSize: 13, color: theme.text, fontWeight: '600' },
  reason: { fontSize: 12.5, color: theme.textFaint, lineHeight: 18 },
  miniRow: { flexDirection: 'row', gap: 16, marginTop: 2 },
  miniItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  miniDot: { width: 6, height: 6, borderRadius: 3 },
  miniText: { fontSize: 12, color: theme.textDim },
  footNote: {
    color: theme.textFaint,
    fontSize: 11.5,
    lineHeight: 17,
    textAlign: 'center',
    paddingHorizontal: 10,
    marginTop: 6,
  },
});
