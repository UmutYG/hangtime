import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { fmtDuration, fmtPace, paceSecPerKm, Run, runStats, weeklyKmSeries } from '../engine/runs';
import { useStore } from '../hooks/useStore';
import { theme, mono, modeIdentity, type } from '../theme';
import { ModeSwitch } from '../components/ModeSwitch';
import { ModeMark } from '../components/ModeMark';
import { WeeklyBars } from '../components/WeeklyBars';
import { RunLog } from '../components/RunLog';
import { RunTracker } from '../components/RunTracker';
import { ReadinessCard } from '../components/ReadinessCard';
import { useReadiness } from '../hooks/useReadiness';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
function todayLabel(): string {
  return new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}
function fmtDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function RunsHomeScreen() {
  const { store, syncHealth, addRun, editRun } = useStore();
  const { width } = useWindowDimensions();
  const [logOpen, setLogOpen] = useState(false);
  const [trackerOpen, setTrackerOpen] = useState(false);
  const [editing, setEditing] = useState<Run | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const readinessInfo = useReadiness('run');
  const stats = useMemo(() => runStats(store.runs, todayIso()), [store.runs]);
  const weekly = useMemo(() => weeklyKmSeries(store.runs, todayIso(), 8), [store.runs]);
  const recent = useMemo(() => [...store.runs].reverse().slice(0, 5), [store.runs]);

  const chartWidth = Math.min(width, 480) - theme.pad * 2 - 40;

  const doSync = async () => {
    setSyncing(true);
    setSyncMsg(null);
    const result = await syncHealth();
    setSyncing(false);
    if (result === 'unavailable') {
      setSyncMsg('Apple Health needs the installed app (TestFlight) — not Expo Go or web.');
    } else if (result === 'denied') {
      setSyncMsg('Health access was declined — enable it in Settings → Health → Data Access.');
    } else {
      setSyncMsg(
        result.added > 0 ? `Imported ${result.added} run${result.added === 1 ? '' : 's'}.` : 'Up to date.'
      );
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ModeSwitch />
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.dateLabel}>{todayLabel()}</Text>
          <Text style={type.hero}>Runs</Text>
        </View>
      </View>
      <View style={styles.mottoRow}>
        <ModeMark mode="running" size={15} color={theme.run} />
        <Text style={styles.mottoText}>{modeIdentity('running').motto}</Text>
      </View>

      <ReadinessCard readiness={readinessInfo} accent={theme.run} />

      {store.runs.length === 0 ? (
        <View style={styles.card}>
          <Text style={[type.kickerDim, { color: theme.run }]}>APPLE HEALTH</Text>
          <Text style={styles.emptyLead}>Bring your runs into your own space.</Text>
          <Text style={styles.emptyBody}>
            Connect Apple Health to import every run you've ever recorded — Goals, Watch, any app —
            and keep new ones flowing in automatically.
          </Text>
          <Pressable onPress={doSync} style={[styles.connectBtn, syncing && { opacity: 0.6 }]}>
            <Text style={styles.connectText}>{syncing ? 'Connecting…' : 'Connect Apple Health'}</Text>
          </Pressable>
          {syncMsg ? <Text style={styles.syncMsg}>{syncMsg}</Text> : null}
        </View>
      ) : (
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={[type.kickerDim, { color: theme.run }]}>THIS WEEK</Text>
            <Pressable onPress={doSync} disabled={syncing}>
              <Text style={styles.syncBtn}>{syncing ? 'Syncing…' : '↻ Sync Health'}</Text>
            </Pressable>
          </View>
          <View style={styles.bigRow}>
            <Text style={[styles.bigValue, mono]}>{stats.thisWeekKm}</Text>
            <Text style={styles.bigUnit}>km</Text>
          </View>
          <WeeklyBars data={weekly} width={chartWidth} />
          {syncMsg ? <Text style={styles.syncMsg}>{syncMsg}</Text> : null}
        </View>
      )}

      <Pressable onPress={() => setTrackerOpen(true)} style={styles.startRunBtn}>
        <Text style={styles.startRunText}>Start run</Text>
      </Pressable>
      <Pressable onPress={() => setLogOpen(true)} style={styles.logBtn}>
        <Text style={styles.logBtnText}>Log a run manually</Text>
      </Pressable>

      {recent.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>Recent</Text>
          <View style={{ gap: 8 }}>
            {recent.map((r) => (
              <Pressable
                key={r.id}
                onPress={() => (r.source === 'manual' ? setEditing(r) : undefined)}
                style={styles.row}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>
                    {r.distanceKm.toFixed(r.distanceKm >= 10 ? 1 : 2)} km
                  </Text>
                  <Text style={styles.rowMeta}>
                    {fmtDate(r.date)} · {fmtDuration(r.durationSec)}
                    {r.source === 'health' ? ' · Health' : ''}
                  </Text>
                </View>
                <Text style={[styles.rowPace, mono]}>{fmtPace(paceSecPerKm(r))}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      <RunTracker
        visible={trackerOpen}
        onClose={() => setTrackerOpen(false)}
        onSave={(run) => addRun(run)}
        cueSeed={store.runs.length}
      />
      <RunLog
        visible={logOpen}
        onClose={() => setLogOpen(false)}
        onSave={(run) => {
          addRun(run);
          setLogOpen(false);
        }}
      />
      <RunLog
        visible={editing !== null}
        initial={editing ?? undefined}
        onClose={() => setEditing(null)}
        onSave={(run) => {
          editRun(run);
          setEditing(null);
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: theme.pad, gap: 14, paddingBottom: 120 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  mottoRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: -6 },
  mottoText: { color: theme.textFaint, fontSize: 12.5, fontWeight: '500', letterSpacing: 0.1 },
  dateLabel: { color: theme.textFaint, fontSize: 13, fontWeight: '500' },
  card: {
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: theme.radiusLg,
    padding: 18,
    gap: 10,
  },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  syncBtn: { color: theme.run, fontSize: 12.5, fontWeight: '600' },
  bigRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  bigValue: { fontSize: 40, fontWeight: '600', color: theme.text, letterSpacing: -1 },
  bigUnit: { fontSize: 15, color: theme.textFaint },
  emptyLead: { fontSize: 15.5, fontWeight: '700', color: theme.text },
  emptyBody: { fontSize: 13, lineHeight: 19.5, color: theme.textDim },
  connectBtn: {
    backgroundColor: theme.run,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  connectText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  syncMsg: { fontSize: 12, color: theme.textFaint },
  startRunBtn: {
    backgroundColor: theme.run,
    borderRadius: 999,
    paddingVertical: 17,
    alignItems: 'center',
  },
  startRunText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  logBtn: { alignItems: 'center', paddingVertical: 4 },
  logBtnText: { color: theme.textFaint, fontSize: 13 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: theme.text, marginTop: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: theme.radius,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  rowTitle: { fontSize: 15, fontWeight: '700', color: theme.text },
  rowMeta: { fontSize: 12, color: theme.textFaint, marginTop: 2 },
  rowPace: { fontSize: 13, color: theme.textDim },
});
