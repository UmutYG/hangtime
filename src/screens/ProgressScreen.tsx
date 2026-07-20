import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useStore } from '../hooks/useStore';
import { computeGoals } from '../engine/goals';
import { e1rmSystem } from '../engine/epley';
import { theme, mono, type } from '../theme';
import { TrendChart, Point } from '../components/TrendChart';
import { RunningCard } from '../components/RunningCard';
import { SettingsSheet } from '../components/SettingsSheet';

type Metric = 'e1rm' | 'bwMax';
type Range = '1m' | '3m' | 'all';

export function ProgressScreen() {
  const { store } = useStore();
  const { width } = useWindowDimensions();
  const [metric, setMetric] = useState<Metric>('e1rm');
  const [range, setRange] = useState<Range>('3m');
  const [settingsOpen, setSettingsOpen] = useState(false);

  const profile = store.profile!;

  const points = useMemo((): Point[] => {
    const cutoff = new Date();
    if (range === '1m') cutoff.setMonth(cutoff.getMonth() - 1);
    else if (range === '3m') cutoff.setMonth(cutoff.getMonth() - 3);
    else cutoff.setFullYear(2000);
    const cut = cutoff.toISOString().slice(0, 10);

    if (metric === 'e1rm') {
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

  const chartWidth = Math.min(width, 480) - theme.pad * 2 - 40;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={type.hero}>Progress</Text>
        <Pressable onPress={() => setSettingsOpen(true)} style={styles.gearBtn} hitSlop={10}>
          <Text style={styles.gearIcon}>⚙</Text>
        </Pressable>
      </View>

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

      <RunningCard width={chartWidth} />

      <View style={styles.card}>
        <Text style={type.kickerDim}>GOALS</Text>
        {goals.length === 0 ? (
          <Text style={styles.dim}>Goals appear after calibration.</Text>
        ) : (
          goals.map((g, i) => {
            const pct = Math.min(
              100,
              Math.max(
                4,
                Math.round(
                  ((g.targetValue - g.currentValue === 0 ? 1 : g.currentValue) / g.targetValue) * 100
                )
              )
            );
            return (
              <View key={g.quality} style={i > 0 ? { marginTop: 16 } : { marginTop: 12 }}>
                <View style={styles.goalRow}>
                  <Text style={styles.goalLabel}>{g.label}</Text>
                  <Text style={styles.goalEta}>ETA {g.etaMonth}</Text>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${pct}%` }]} />
                </View>
              </View>
            );
          })
        )}
        {goals.length > 0 ? (
          <Text style={styles.goalFootnote}>
            ETAs assume your current pace holds, with a deload every 4th week.
          </Text>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={type.kickerDim}>PERSONAL RECORDS</Text>
        {store.prs.length === 0 ? (
          <Text style={styles.dim}>PRs land here — first ones usually within 2 weeks.</Text>
        ) : (
          [...store.prs]
            .reverse()
            .slice(0, 8)
            .map((pr, i) => (
              <View key={i} style={styles.prRow}>
                <Text style={styles.prText}>
                  {pr.kind === 'bwReps' ? 'Bodyweight max' : 'Estimated 1RM'}
                </Text>
                <Text style={[styles.prValue, mono]}>
                  {pr.kind === 'bwReps' ? `${pr.value} reps` : `${pr.value} kg`} · {pr.date.slice(5)}
                </Text>
              </View>
            ))
        )}
      </View>

      <SettingsSheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
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
    gap: 6,
  },
  segRow: { flexDirection: 'row', gap: 8 },
  seg: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9,
    backgroundColor: theme.cardMuted,
    borderWidth: 1,
    borderColor: theme.border,
  },
  segSmall: { paddingHorizontal: 14 },
  segActive: { borderColor: theme.accent, backgroundColor: theme.cardTint },
  segText: { color: theme.textDim, fontSize: 12, fontWeight: '600' },
  segTextActive: { color: theme.accentDark },
  goalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  goalLabel: { color: theme.text, fontSize: 13.5, fontWeight: '600' },
  goalEta: { color: theme.textFaint, fontSize: 12.5 },
  barTrack: { marginTop: 7, height: 6, borderRadius: 3, backgroundColor: theme.cardMuted },
  barFill: { height: 6, borderRadius: 3, backgroundColor: theme.accent },
  goalFootnote: { color: theme.textFaint, fontSize: 11.5, marginTop: 14, lineHeight: 17 },
  prRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    marginTop: 4,
  },
  prText: { color: theme.text, fontSize: 13.5 },
  prValue: { color: theme.textDim, fontSize: 13 },
});
