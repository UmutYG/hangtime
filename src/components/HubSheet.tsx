import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { computeReadiness, Modality, weeklyLoad } from '../engine/load';
import { generateSession } from '../engine/generator';
import { generatePushSession } from '../engine/pushups';
import { runStats } from '../engine/runs';
import { useStore } from '../hooks/useStore';
import { useLoadEntries } from '../hooks/useReadiness';
import { theme, mono, type } from '../theme';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const MODES: Array<{ key: Modality; mode: 'pullups' | 'pushups' | 'running'; name: string; color: string }> = [
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

/** One body, three spaces — the whole picture in a glance. */
export function HubSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { store, setAppMode } = useStore();
  const entries = useLoadEntries();
  const today = todayIso();
  const week = weeklyLoad(entries, today);
  const runS = runStats(store.runs, today);

  const rows = MODES.map((m) => {
    const readiness = computeReadiness(m.key, entries, today, store.externalReadiness ?? null);
    let plan = '—';
    let done = false;
    if (m.key === 'pull' && store.profile) {
      plan = generateSession(store.profile, store.state, today).title;
      done = store.sessions.some((s) => s.date === today && s.dayKind !== 'custom');
    } else if (m.key === 'push') {
      plan = store.pushState ? generatePushSession(store.pushState).title : 'Not set up yet';
      done = store.pushSessions.some((s) => s.date === today && s.dayKind !== 'pushCustom');
    } else {
      plan = `${runS.thisWeekKm} km this week`;
      done = store.runs.some((r) => r.date === today);
    }
    const load = week[m.key];
    return { ...m, readiness, plan, done, load };
  });

  const maxLoad = Math.max(1, ...rows.map((r) => r.load));

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.topRow}>
          <Text style={type.hero}>Your week</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={styles.close}>Close</Text>
          </Pressable>
        </View>
        <Text style={styles.sub}>
          One body, three spaces. Readiness accounts for everything you've trained — a hard pull
          day is not free when push day comes around.
        </Text>

        {rows.map((r) => (
          <Pressable
            key={r.key}
            onPress={() => {
              setAppMode(r.mode);
              onClose();
            }}
            style={styles.card}
          >
            <View style={styles.cardHeader}>
              <View style={styles.nameRow}>
                <View style={[styles.chip, { backgroundColor: r.color }]} />
                <Text style={styles.name}>{r.name}</Text>
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
            <Text style={styles.reason}>{r.readiness.reasons[0]}</Text>
          </Pressable>
        ))}

        <View style={styles.card}>
          <Text style={styles.kicker}>THIS WEEK'S LOAD</Text>
          <Text style={styles.loadHint}>
            Duration × effort, the standard way to compare very different sessions.
          </Text>
          {rows.map((r) => (
            <View key={r.key} style={styles.loadRow}>
              <Text style={styles.loadName}>{r.name}</Text>
              <View style={styles.loadBarTrack}>
                <View
                  style={[
                    styles.loadBarFill,
                    { width: `${(r.load / maxLoad) * 100}%`, backgroundColor: r.color },
                  ]}
                />
              </View>
              <Text style={[styles.loadValue, mono]}>{r.load}</Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={[styles.totalValue, mono]}>{week.total}</Text>
          </View>
        </View>

        <View style={[styles.card, styles.futureCard]}>
          <Text style={styles.kicker}>BODY READINESS</Text>
          <Text style={styles.futureText}>
            {store.externalReadiness
              ? `${store.externalReadiness.source}: ${store.externalReadiness.score}/100 — blended into every readiness score above.`
              : 'No wearable connected. When you add an Oura ring or Whoop, its daily readiness blends into the scores above — the plumbing is already here, only the provider is missing.'}
          </Text>
        </View>
      </ScrollView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  content: { padding: theme.pad, paddingTop: 60, gap: 12, paddingBottom: 50 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  close: { color: theme.textFaint, fontSize: 14 },
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
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chip: { width: 10, height: 10, borderRadius: 5 },
  name: { fontSize: 16, fontWeight: '700', color: theme.text },
  readinessScore: { fontSize: 16, fontWeight: '600', color: theme.textDim },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: theme.cardMuted, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  meta: { fontSize: 13, color: theme.text, fontWeight: '600' },
  reason: { fontSize: 12.5, color: theme.textFaint, lineHeight: 18 },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, color: theme.textFaint },
  loadHint: { fontSize: 12, color: theme.textFaint, lineHeight: 17 },
  loadRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  loadName: { fontSize: 13, color: theme.textDim, width: 72 },
  loadBarTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.cardMuted,
    overflow: 'hidden',
  },
  loadBarFill: { height: 8, borderRadius: 4 },
  loadValue: { fontSize: 12.5, color: theme.textDim, width: 44, textAlign: 'right' },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: theme.cardMuted,
    paddingTop: 10,
    marginTop: 2,
  },
  totalLabel: { fontSize: 13, fontWeight: '700', color: theme.text },
  totalValue: { fontSize: 13, fontWeight: '700', color: theme.text },
  futureCard: { backgroundColor: theme.cardMuted },
  futureText: { fontSize: 12.5, lineHeight: 19, color: theme.textDim },
});
