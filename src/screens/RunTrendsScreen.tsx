import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { fmtPace, runStats, weeklyKmSeries } from '../engine/runs';
import { useStore } from '../hooks/useStore';
import { theme, mono, type } from '../theme';
import { ModeSwitch } from '../components/ModeSwitch';
import { WeeklyBars } from '../components/WeeklyBars';
import { SettingsSheet } from '../components/SettingsSheet';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function RunTrendsScreen() {
  const { store } = useStore();
  const { width } = useWindowDimensions();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const stats = useMemo(() => runStats(store.runs, todayIso()), [store.runs]);
  const weekly12 = useMemo(() => weeklyKmSeries(store.runs, todayIso(), 12), [store.runs]);
  const chartWidth = Math.min(width, 480) - theme.pad * 2 - 40;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ModeSwitch />
      <View style={styles.headerRow}>
        <Text style={type.hero}>Trends</Text>
        <Pressable onPress={() => setSettingsOpen(true)} style={styles.gearBtn} hitSlop={10}>
          <Text style={styles.gearIcon}>⚙</Text>
        </Pressable>
      </View>

      <View style={styles.statRow}>
        <View style={styles.stat}>
          <Text style={[styles.statValue, mono]}>{stats.totalKm}</Text>
          <Text style={styles.statLabel}>lifetime km</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statValue, mono]}>{stats.totalRuns}</Text>
          <Text style={styles.statLabel}>runs</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statValue, mono]}>{stats.last4wKm}</Text>
          <Text style={styles.statLabel}>km · 4 weeks</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={[type.kickerDim, { color: theme.run }]}>WEEKLY DISTANCE · 12 WEEKS</Text>
        <WeeklyBars data={weekly12} width={chartWidth} height={110} showValues />
      </View>

      <View style={styles.card}>
        <Text style={[type.kickerDim, { color: theme.run }]}>BESTS</Text>
        <View style={styles.bestRow}>
          <Text style={styles.bestLabel}>Longest run</Text>
          <Text style={[styles.bestValue, mono]}>{stats.longestKm} km</Text>
        </View>
        <View style={[styles.bestRow, { borderBottomWidth: 0 }]}>
          <Text style={styles.bestLabel}>Best pace (runs ≥ 2 km)</Text>
          <Text style={[styles.bestValue, mono]}>{fmtPace(stats.bestPaceSecPerKm)}</Text>
        </View>
      </View>

      {store.runs.length === 0 ? (
        <Text style={styles.empty}>Trends appear once your runs come in — connect Apple Health or log one from the Runs tab.</Text>
      ) : null}

      <SettingsSheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  content: { padding: theme.pad, gap: 14, paddingBottom: 120 },
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
  bestRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.cardMuted,
  },
  bestLabel: { fontSize: 14, color: theme.textDim },
  bestValue: { fontSize: 14, fontWeight: '600', color: theme.text },
  empty: { color: theme.textFaint, fontSize: 13, textAlign: 'center', lineHeight: 19 },
});
