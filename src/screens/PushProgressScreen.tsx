import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { computePushGoal, PUSH_MILESTONES } from '../engine/pushups';
import { useStore } from '../hooks/useStore';
import { theme, mono, type } from '../theme';
import { ModeSwitch } from '../components/ModeSwitch';
import { TrendChart, Point } from '../components/TrendChart';
import { SettingsSheet } from '../components/SettingsSheet';
import { MasteryPath } from '../components/MasteryPath';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function PushProgressScreen() {
  const { store } = useStore();
  const { width } = useWindowDimensions();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const push = store.pushState;

  const points = useMemo((): Point[] => {
    return store.pushSessions
      .filter((s) => ['pushMax', 'pushTest', 'pushPyramid'].includes(s.dayKind))
      .map((s) => ({
        date: s.date,
        value: Math.max(0, ...s.sets.filter((x) => !x.isWarmup).map((x) => x.actualReps)),
      }))
      .filter((p) => p.value > 0);
  }, [store.pushSessions]);

  const weeksActive = useMemo(() => {
    const weeks = new Set(
      store.pushSessions.map((s) => {
        const d = new Date(s.date);
        const monday = new Date(d);
        monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
        return monday.toISOString().slice(0, 10);
      })
    );
    return weeks.size;
  }, [store.pushSessions]);

  const goal = push ? computePushGoal(push, todayIso()) : null;
  const pushPrs = store.prs.filter((p) => p.kind === 'pushMax');
  const chartWidth = Math.min(width, 480) - theme.pad * 2 - 40;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ModeSwitch />
      <View style={styles.headerRow}>
        <Text style={type.hero}>Progress</Text>
        <Pressable onPress={() => setSettingsOpen(true)} style={styles.gearBtn} hitSlop={10}>
          <Text style={styles.gearIcon}>⚙</Text>
        </Pressable>
      </View>

      <View style={styles.statRow}>
        <View style={styles.stat}>
          <Text style={[styles.statValue, mono]}>{store.pushLifetimeReps}</Text>
          <Text style={styles.statLabel}>lifetime reps</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statValue, mono]}>{push?.bestMaxSet ?? '—'}</Text>
          <Text style={styles.statLabel}>best set</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statValue, mono]}>{weeksActive}</Text>
          <Text style={styles.statLabel}>weeks trained</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={[type.kickerDim, { color: theme.push }]}>MAX SET OVER TIME</Text>
        <TrendChart points={points} width={chartWidth} unit="reps" accent={theme.push} />
      </View>

      <View style={styles.card}>
        <Text style={[type.kickerDim, { color: theme.push }]}>MILESTONES</Text>
        <View style={styles.mileRow}>
          {PUSH_MILESTONES.map((m) => {
            const hit = (push?.lastTestReps ?? 0) >= m;
            return (
              <View key={m} style={[styles.milePill, hit && { backgroundColor: theme.push, borderColor: theme.push }]}>
                <Text style={[styles.mileText, hit && { color: '#FFF' }]}>{m}</Text>
              </View>
            );
          })}
        </View>
        {goal ? (
          <Text style={styles.goalLine}>
            Next: <Text style={{ fontWeight: '700', color: theme.text }}>{goal.label}</Text> — ETA{' '}
            {goal.etaMonth}. Tested max moves only on test days, so the goal stays honest.
          </Text>
        ) : (
          <Text style={styles.goalLine}>All milestones cleared — 100+ club.</Text>
        )}
      </View>

      <MasteryPath sessions={store.pushSessions} />

      <View style={styles.card}>
        <Text style={[type.kickerDim, { color: theme.push }]}>PERSONAL RECORDS</Text>
        {pushPrs.length === 0 ? (
          <Text style={styles.dim}>PRs land here — usually within the first two weeks.</Text>
        ) : (
          [...pushPrs]
            .reverse()
            .slice(0, 8)
            .map((pr, i) => (
              <View key={i} style={styles.prRow}>
                <Text style={styles.prText}>Max set</Text>
                <Text style={[styles.prValue, mono]}>
                  {pr.value} reps · {pr.date.slice(5)}
                </Text>
              </View>
            ))
        )}
      </View>

      <SettingsSheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: theme.pad, gap: 12, paddingBottom: 120 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
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
  dim: { color: theme.textFaint, fontSize: 13, marginTop: 8 },
  statRow: { flexDirection: 'row', gap: 10 },
  stat: {
    flex: 1,
    backgroundColor: theme.card,
    borderRadius: theme.radiusLg,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 12,
    alignItems: 'center',
  },
  statValue: { color: theme.text, fontSize: 21, fontWeight: '700' },
  statLabel: { color: theme.textFaint, fontSize: 11, marginTop: 2 },
  card: {
    backgroundColor: theme.card,
    borderRadius: theme.radiusLg,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 18,
    gap: 12,
  },
  mileRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  milePill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: theme.cardMuted,
    borderWidth: 1,
    borderColor: theme.border,
  },
  mileText: { color: theme.textDim, fontSize: 13.5, fontWeight: '700' },
  goalLine: { color: theme.textDim, fontSize: 13, lineHeight: 19.5 },
  prRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  prText: { color: theme.text, fontSize: 13.5 },
  prValue: { color: theme.textDim, fontSize: 13 },
});
