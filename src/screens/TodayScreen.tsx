import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { generateSession } from '../engine/generator';
import { Readiness } from '../engine/types';
import { useStore } from '../hooks/useStore';
import { useWorkout } from '../hooks/useWorkout';
import { theme, mono, type } from '../theme';
import { WhyCard } from '../components/WhyCard';
import { WhySheet } from '../components/WhySheet';
import { ManualLog } from '../components/ManualLog';
import { ProgressRing } from '../components/ProgressRing';
import { ModeSwitch } from '../components/ModeSwitch';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
function todayLabel(): string {
  return new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

const READINESS: Array<{ key: Readiness; label: string }> = [
  { key: 'good', label: 'Good' },
  { key: 'ok', label: 'OK' },
  { key: 'rough', label: 'Rough' },
];

export function TodayScreen() {
  const { store } = useStore();
  const workout = useWorkout();
  const [readiness, setReadiness] = useState<Readiness | undefined>();
  const [whyOpen, setWhyOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const { editSession } = useStore();

  const profile = store.profile!;
  const plan = useMemo(
    () => generateSession(profile, store.state, todayIso(), readiness),
    [profile, store.state, readiness]
  );

  const doneToday = store.sessions.some((s) => s.date === todayIso() && s.dayKind !== 'custom');
  const lastDoneToday = useMemo(
    () => [...store.sessions].reverse().find((s) => s.date === todayIso() && s.dayKind !== 'custom'),
    [store.sessions]
  );

  const doneThisWeek = useMemo(() => {
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    return store.sessions.filter((s) => s.dayKind !== 'custom' && new Date(s.date) >= monday).length;
  }, [store.sessions]);

  const workingSets = plan.sets.filter((s) => !s.isWarmup);
  const maxLoad = Math.max(0, ...plan.sets.map((s) => s.loadKg));
  const repsRange = workingSets.length
    ? `${workingSets.length}×${workingSets[0].amrap ? `${workingSets[0].targetReps}+` : workingSets[0].targetReps}`
    : '—';
  const restLabel = workingSets[0]
    ? `${Math.floor(workingSets[0].restSecAfter / 60)}:${(workingSets[0].restSecAfter % 60)
        .toString()
        .padStart(2, '0')}`
    : '—';

  const e1rmDisplay = store.state.e1rmKg ? Math.round(store.state.e1rmKg * 10) / 10 : null;
  const weekFraction = (store.state.week - 1 + Math.min(store.state.sessionInWeek, 3) / 3) / 4;
  const deloadInDays = (4 - store.state.week) * 7 || 0;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <ModeSwitch />
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.dateLabel}>{todayLabel()}</Text>
          <Text style={type.hero}>Today</Text>
        </View>
        <View style={styles.cycleChip}>
          <Text style={styles.cycleChipText}>
            CYCLE {plan.cycle} · WEEK {plan.week}
          </Text>
        </View>
      </View>

      {doneToday ? (
        <View style={styles.card}>
          <View style={styles.doneRow}>
            <View style={styles.doneCheck}>
              <Text style={styles.doneCheckText}>✓</Text>
            </View>
            <Text style={styles.doneTitle}>Session complete</Text>
          </View>
          <Text style={styles.doneBody}>
            {lastDoneToday
              ? `${lastDoneToday.sets.filter((s) => !s.isWarmup).length} sets, ${lastDoneToday.sets.reduce((sum, s) => sum + s.actualReps, 0)} reps logged.`
              : ''}{' '}
            Your next session appears here tomorrow — the engine has already adjusted it.
          </Text>
        </View>
      ) : (
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={type.kicker}>{plan.title.toUpperCase()}</Text>
            <Pressable onPress={() => setWhyOpen(true)} style={styles.whyPill}>
              <Text style={styles.whyPillText}>Why?</Text>
            </Pressable>
          </View>
          <Text style={styles.sessionTitle}>{plan.title.replace(/^(Vest|Heavy|Volume|Max|Ladder|Deload).*—\s*/, '')}</Text>
          <View style={styles.statRow3}>
            <View>
              <Text style={[styles.statBig, mono]}>{repsRange}</Text>
              <Text style={styles.statCaption}>sets × reps</Text>
            </View>
            {maxLoad > 0 ? (
              <View>
                <Text style={[styles.statBig, mono]}>+{maxLoad}</Text>
                <Text style={styles.statCaption}>kg vest</Text>
              </View>
            ) : null}
            <View>
              <Text style={[styles.statBig, mono]}>{restLabel}</Text>
              <Text style={styles.statCaption}>rest</Text>
            </View>
          </View>

          <View style={styles.readinessRow}>
            {READINESS.map((r) => (
              <Pressable
                key={r.key}
                onPress={() => setReadiness(readiness === r.key ? undefined : r.key)}
                style={[styles.readinessChip, readiness === r.key && styles.readinessChipActive]}
              >
                <Text
                  style={[styles.readinessChipText, readiness === r.key && { color: theme.onAccent }]}
                >
                  {r.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={() => workout.start(plan, readiness)}
            style={styles.startBtn}
          >
            <Text style={styles.startBtnText}>Start session</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.ringCard}>
        <ProgressRing size={52} stroke={5} fraction={weekFraction} />
        <View style={{ flex: 1 }}>
          <Text style={styles.ringTitle}>Week {store.state.week} of 4</Text>
          <Text style={styles.ringSub}>
            {deloadInDays > 0
              ? `Deload in ~${deloadInDays} days`
              : 'Deload week — retest coming up'}
          </Text>
        </View>
      </View>

      <View style={styles.statPairRow}>
        <View style={styles.statTile}>
          <Text style={styles.statTileLabel}>EST. 1RM</Text>
          <Text style={[styles.statTileValue, mono]}>{e1rmDisplay ? `${e1rmDisplay} kg` : '—'}</Text>
        </View>
        <View style={styles.statTile}>
          <Text style={styles.statTileLabel}>BW MAX</Text>
          <Text style={[styles.statTileValue, mono]}>{store.state.bwLastTestReps} reps</Text>
        </View>
      </View>

      {!doneToday ? <WhyCard why={plan.why} /> : null}

      <Pressable onPress={() => setLogOpen(true)} style={styles.linkBtn}>
        <Text style={styles.linkText}>Log a session done elsewhere</Text>
      </Pressable>

      <WhySheet
        visible={whyOpen}
        onClose={() => setWhyOpen(false)}
        plan={plan}
        state={store.state}
        profile={profile}
      />
      <ManualLog
        visible={logOpen}
        defaultLoadKg={profile.equipment.fixedLoadKg}
        onClose={() => setLogOpen(false)}
        onSave={(session) => {
          editSession(session);
          setLogOpen(false);
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  content: { padding: theme.pad, gap: 12, paddingBottom: 120 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  dateLabel: { color: theme.textFaint, fontSize: 13, fontWeight: '500' },
  cycleChip: {
    backgroundColor: theme.cardMuted,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  cycleChipText: { color: theme.textDim, fontSize: 11, fontWeight: '600', letterSpacing: 0.6 },
  card: {
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: theme.radiusLg,
    padding: 20,
    gap: 4,
  },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  whyPill: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  whyPillText: { color: theme.textDim, fontSize: 12, fontWeight: '600' },
  sessionTitle: { fontSize: 23, fontWeight: '700', letterSpacing: -0.3, color: theme.text, marginTop: 6 },
  statRow3: { flexDirection: 'row', gap: 24, marginTop: 16 },
  statBig: { fontSize: 25, fontWeight: '600', color: theme.text },
  statCaption: { fontSize: 11, color: theme.textFaint, marginTop: 2 },
  readinessRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  readinessChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: theme.cardMuted,
    borderWidth: 1,
    borderColor: theme.border,
  },
  readinessChipActive: { backgroundColor: theme.accent, borderColor: theme.accent },
  readinessChipText: { color: theme.textDim, fontSize: 12.5, fontWeight: '600' },
  startBtn: {
    marginTop: 18,
    backgroundColor: theme.accent,
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
  },
  startBtnText: { color: theme.onAccent, fontSize: 16, fontWeight: '700' },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  doneCheck: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: theme.good,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneCheckText: { color: theme.onAccent, fontSize: 13, fontWeight: '700' },
  doneTitle: { fontSize: 17, fontWeight: '700', color: theme.text },
  doneBody: { fontSize: 13.5, color: theme.textDim, lineHeight: 20, marginTop: 4 },
  ringCard: {
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: theme.radius,
    padding: 16,
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
  },
  ringTitle: { fontSize: 14, fontWeight: '600', color: theme.text },
  ringSub: { fontSize: 12, color: theme.textFaint, marginTop: 2 },
  statPairRow: { flexDirection: 'row', gap: 12 },
  statTile: {
    flex: 1,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: theme.radius,
    padding: 14,
  },
  statTileLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.6, color: theme.textFaint },
  statTileValue: { fontSize: 20, fontWeight: '600', color: theme.text, marginTop: 4 },
  linkBtn: { alignItems: 'center', paddingVertical: 10 },
  linkText: { color: theme.textFaint, fontSize: 13 },
});
