import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { fmtPace, runStats, weeklyKmSeries } from '../engine/runs';
import { useStore } from '../hooks/useStore';
import { theme, mono, type } from '../theme';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** tiny weekly-km bar chart, design-system styled */
function WeeklyBars({ data, width }: { data: Array<{ value: number }>; width: number }) {
  const height = 64;
  const gap = 6;
  const barW = (width - gap * (data.length - 1)) / data.length;
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <Svg width={width} height={height}>
      {data.map((d, i) => {
        const h = Math.max(3, (d.value / max) * (height - 6));
        return (
          <Rect
            key={i}
            x={i * (barW + gap)}
            y={height - h}
            width={barW}
            height={h}
            rx={3}
            fill={i === data.length - 1 ? theme.run : theme.cardMuted}
            stroke={i === data.length - 1 ? 'none' : theme.border}
            strokeWidth={i === data.length - 1 ? 0 : 1}
          />
        );
      })}
    </Svg>
  );
}

export function RunningCard({ width }: { width: number }) {
  const { store, syncHealth } = useStore();
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const stats = useMemo(() => runStats(store.runs, todayIso()), [store.runs]);
  const weekly = useMemo(() => weeklyKmSeries(store.runs, todayIso(), 8), [store.runs]);

  const doSync = async () => {
    setSyncing(true);
    setSyncMsg(null);
    const result = await syncHealth();
    setSyncing(false);
    if (result === 'unavailable') {
      setSyncMsg('Apple Health works after the TestFlight build (not in Expo Go).');
    } else if (result === 'denied') {
      setSyncMsg('Health access was declined — enable it in Settings → Health → Data Access.');
    } else {
      setSyncMsg(result.added > 0 ? `Imported ${result.added} run${result.added === 1 ? '' : 's'}.` : 'Up to date.');
    }
  };

  if (store.runs.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={[type.kickerDim, { color: theme.run }]}>RUNNING</Text>
        <Text style={styles.emptyLead}>Bring your runs into your own space.</Text>
        <Text style={styles.emptyBody}>
          Connect Apple Health to import every run you've ever recorded — Goals, Watch, any app —
          and keep new ones flowing in automatically.
        </Text>
        <Pressable onPress={doSync} style={[styles.connectBtn, syncing && { opacity: 0.6 }]}>
          <Text style={styles.connectText}>{syncing ? 'Connecting…' : 'Connect Apple Health'}</Text>
        </Pressable>
        {syncMsg ? <Text style={styles.syncMsg}>{syncMsg}</Text> : null}
        <Text style={styles.orManual}>Or log runs by hand from History → + Log.</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={[type.kickerDim, { color: theme.run }]}>RUNNING</Text>
        <Pressable onPress={doSync} disabled={syncing}>
          <Text style={styles.syncBtn}>{syncing ? 'Syncing…' : '↻ Sync Health'}</Text>
        </Pressable>
      </View>
      <View style={styles.bigRow}>
        <Text style={[styles.bigValue, mono]}>{stats.thisWeekKm}</Text>
        <Text style={styles.bigUnit}>km this week</Text>
      </View>
      <WeeklyBars data={weekly} width={width} />
      <View style={styles.statRow}>
        <View style={styles.stat}>
          <Text style={[styles.statValue, mono]}>{stats.last4wKm}</Text>
          <Text style={styles.statLabel}>km · 4 weeks</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statValue, mono]}>{stats.longestKm}</Text>
          <Text style={styles.statLabel}>longest (km)</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statValue, mono]}>{fmtPace(stats.bestPaceSecPerKm).replace(' /km', '')}</Text>
          <Text style={styles.statLabel}>best pace</Text>
        </View>
      </View>
      {syncMsg ? <Text style={styles.syncMsg}>{syncMsg}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.card,
    borderRadius: theme.radiusLg,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 18,
    gap: 10,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  syncBtn: { color: theme.run, fontSize: 12.5, fontWeight: '600' },
  bigRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  bigValue: { fontSize: 28, fontWeight: '600', color: theme.text },
  bigUnit: { fontSize: 13, color: theme.textFaint },
  statRow: { flexDirection: 'row', gap: 10, marginTop: 2 },
  stat: { flex: 1 },
  statValue: { fontSize: 16, fontWeight: '600', color: theme.text },
  statLabel: { fontSize: 11, color: theme.textFaint, marginTop: 2 },
  emptyLead: { fontSize: 15.5, fontWeight: '700', color: theme.text },
  emptyBody: { fontSize: 13, lineHeight: 19.5, color: theme.textDim },
  connectBtn: {
    backgroundColor: theme.run,
    borderRadius: 999,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  connectText: { color: '#FFFFFF', fontSize: 14.5, fontWeight: '700' },
  syncMsg: { fontSize: 12, color: theme.textFaint, marginTop: 2 },
  orManual: { fontSize: 12, color: theme.textFaint },
});
