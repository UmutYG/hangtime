import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useStore } from '../hooks/useStore';
import { computeGoals } from '../engine/goals';
import { e1rmSystem } from '../engine/epley';
import { theme, mono } from '../theme';
import { TrendChart, Point } from '../components/TrendChart';

type Metric = 'e1rm' | 'bwMax';
type Range = '1m' | '3m' | 'all';

export function ProgressScreen() {
  const { store } = useStore();
  const { width } = useWindowDimensions();
  const [metric, setMetric] = useState<Metric>('e1rm');
  const [range, setRange] = useState<Range>('3m');

  const profile = store.profile!;

  const points = useMemo((): Point[] => {
    const cutoff = new Date();
    if (range === '1m') cutoff.setMonth(cutoff.getMonth() - 1);
    else if (range === '3m') cutoff.setMonth(cutoff.getMonth() - 3);
    else cutoff.setFullYear(2000);
    const cut = cutoff.toISOString().slice(0, 10);

    if (metric === 'e1rm') {
      // best e1RM implied by any weighted set, per session
      return store.sessions
        .filter((s) => s.date >= cut)
        .map((s) => {
          const best = Math.max(
            0,
            ...s.sets
              .filter((x) => !x.isWarmup && x.loadKg > 0 && x.actualReps > 0)
              .map((x) => e1rmSystem(profile.bodyweightKg, x.loadKg, x.actualReps))
          );
          return { date: s.date, value: Math.round(best * 10) / 10 };
        })
        .filter((p) => p.value > 0);
    }
    // bwMax: best single BW set on max/test days
    return store.sessions
      .filter((s) => s.date >= cut && ['max', 'testBw'].includes(s.dayKind))
      .map((s) => ({
        date: s.date,
        value: Math.max(0, ...s.sets.filter((x) => !x.isWarmup && x.loadKg === 0).map((x) => x.actualReps)),
      }))
      .filter((p) => p.value > 0);
  }, [store.sessions, metric, range, profile.bodyweightKg]);

  const goals = useMemo(
    () => computeGoals(profile, store.state, store.tests, new Date().toISOString().slice(0, 10)),
    [profile, store.state, store.tests]
  );

  const weeksActive = useMemo(() => {
    const weeks = new Set(
      store.sessions.map((s) => {
        const d = new Date(s.date);
        const monday = new Date(d);
        monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
        return monday.toISOString().slice(0, 10);
      })
    );
    return weeks.size;
  }, [store.sessions]);

  const last4wSessions = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 28);
    const cut = cutoff.toISOString().slice(0, 10);
    return store.sessions.filter((s) => s.date >= cut).length;
  }, [store.sessions]);

  const chartWidth = Math.min(width, 480) - theme.pad * 2 - 24;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.h1}>Progress</Text>

      <View style={styles.statRow}>
        <View style={styles.stat}>
          <Text style={[styles.statValue, mono]}>{store.lifetimeReps}</Text>
          <Text style={styles.statLabel}>lifetime reps</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statValue, mono]}>{(last4wSessions / 4).toFixed(1)}</Text>
          <Text style={styles.statLabel}>sessions/week</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statValue, mono]}>{weeksActive}</Text>
          <Text style={styles.statLabel}>weeks trained</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.segRow}>
          <Seg active={metric === 'e1rm'} onPress={() => setMetric('e1rm')} label="Strength (e1RM)" />
          <Seg active={metric === 'bwMax'} onPress={() => setMetric('bwMax')} label="Max reps" />
        </View>
        <TrendChart
          points={points}
          width={chartWidth}
          unit={metric === 'e1rm' ? 'kg system e1RM' : 'reps'}
        />
        <View style={styles.segRow}>
          {(['1m', '3m', 'all'] as Range[]).map((r) => (
            <Seg key={r} active={range === r} onPress={() => setRange(r)} label={r} small />
          ))}
        </View>
      </View>

      <Text style={styles.h2}>Goals</Text>
      {goals.length === 0 ? (
        <Text style={styles.dim}>Goals appear after calibration.</Text>
      ) : (
        goals.map((g) => (
          <View key={g.quality} style={styles.card}>
            <Text style={styles.goalLabel}>{g.label}</Text>
            <View style={styles.goalRow}>
              <Text style={[styles.goalNow, mono]}>
                {g.quality === 'bwReps' ? `${g.currentValue} now` : `+${g.currentValue} kg ×5 now`}
              </Text>
              <Text style={styles.goalEta}>≈ {g.etaMonth}</Text>
            </View>
            <Text style={styles.goalRate}>
              pace: {g.ratePerMonth} {g.quality === 'bwReps' ? 'reps' : 'kg'}/month
            </Text>
          </View>
        ))
      )}

      <Text style={styles.h2}>Personal records</Text>
      {store.prs.length === 0 ? (
        <Text style={styles.dim}>PRs land here — first ones usually within 2 weeks.</Text>
      ) : (
        [...store.prs]
          .reverse()
          .slice(0, 8)
          .map((pr, i) => (
            <View key={i} style={styles.prRow}>
              <Text style={styles.prBadge}>PR</Text>
              <Text style={styles.prText}>
                {pr.kind === 'bwReps' ? `${pr.value} strict pull-ups` : `${pr.value} kg est. 1RM (system)`}
              </Text>
              <Text style={styles.prDate}>{pr.date}</Text>
            </View>
          ))
      )}
    </ScrollView>
  );
}

function Seg({
  active,
  onPress,
  label,
  small,
}: {
  active: boolean;
  onPress: () => void;
  label: string;
  small?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.seg, small && styles.segSmall, active && styles.segActive]}
    >
      <Text style={[styles.segText, active && styles.segTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  content: { padding: theme.pad, gap: 12, paddingBottom: 40 },
  h1: { color: theme.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  h2: { color: theme.text, fontSize: 17, fontWeight: '700', marginTop: 10 },
  dim: { color: theme.textFaint, fontSize: 13 },
  statRow: { flexDirection: 'row', gap: 10 },
  stat: {
    flex: 1,
    backgroundColor: theme.card,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 12,
    alignItems: 'center',
  },
  statValue: { color: theme.text, fontSize: 22, fontWeight: '700' },
  statLabel: { color: theme.textFaint, fontSize: 11, marginTop: 2 },
  card: {
    backgroundColor: theme.card,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 12,
    gap: 10,
  },
  segRow: { flexDirection: 'row', gap: 8 },
  seg: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9,
    backgroundColor: theme.cardRaised,
    borderWidth: 1,
    borderColor: theme.border,
  },
  segSmall: { paddingHorizontal: 14 },
  segActive: { borderColor: theme.accent },
  segText: { color: theme.textDim, fontSize: 12, fontWeight: '600' },
  segTextActive: { color: theme.accent },
  goalLabel: { color: theme.text, fontSize: 16, fontWeight: '700' },
  goalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  goalNow: { color: theme.textDim, fontSize: 14 },
  goalEta: { color: theme.accent, fontSize: 15, fontWeight: '700' },
  goalRate: { color: theme.textFaint, fontSize: 12 },
  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  prBadge: {
    color: theme.onAccent,
    backgroundColor: theme.accent,
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    overflow: 'hidden',
  },
  prText: { color: theme.text, fontSize: 14, flex: 1 },
  prDate: { color: theme.textFaint, fontSize: 12 },
});
