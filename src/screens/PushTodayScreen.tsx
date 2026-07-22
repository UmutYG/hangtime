import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { computePushGoal, generatePushSession } from '../engine/pushups';
import { Readiness } from '../engine/types';
import { useStore } from '../hooks/useStore';
import { useWorkout } from '../hooks/useWorkout';
import { theme, mono, modeIdentity, type } from '../theme';
import { ModeSwitch } from '../components/ModeSwitch';
import { ModeMark } from '../components/ModeMark';
import { ProgressRing } from '../components/ProgressRing';
import { Sheet } from '../components/Sheet';
import { ReadinessCard } from '../components/ReadinessCard';
import { useReadiness } from '../hooks/useReadiness';

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

export function PushTodayScreen() {
  const { store, setPushMax } = useStore();
  const workout = useWorkout();
  const [readiness, setReadiness] = useState<Readiness | undefined>();
  const [whyOpen, setWhyOpen] = useState(false);
  const [maxText, setMaxText] = useState('');

  const push = store.pushState;
  const readinessInfo = useReadiness('push');
  const effectiveReadiness = readiness ?? readinessInfo.suggestion;

  const plan = useMemo(
    () => (push ? generatePushSession(push, effectiveReadiness) : null),
    [push, effectiveReadiness]
  );

  const doneToday = store.pushSessions.some(
    (s) => s.date === todayIso() && s.dayKind !== 'pushCustom'
  );
  const lastDoneToday = useMemo(
    () =>
      [...store.pushSessions].reverse().find((s) => s.date === todayIso() && s.dayKind !== 'pushCustom'),
    [store.pushSessions]
  );

  // ——— first-time setup ———
  if (!push) {
    const maxNum = parseInt(maxText, 10);
    const valid = maxNum >= 3 && maxNum <= 200;
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <ModeSwitch />
        <Text style={styles.dateLabel}>{todayLabel()}</Text>
        <Text style={type.hero}>Push-ups</Text>
        <View style={styles.card}>
          <Text style={[type.kickerDim, { color: theme.push }]}>SET UP YOUR PROGRAM</Text>
          <Text style={styles.setupLead}>How many strict push-ups can you do in one set?</Text>
          <Text style={styles.setupBody}>
            Chest to floor, full lockout. This seeds the same engine that runs your pull-ups —
            pyramid days from the One Hundred Push-ups method, K Boges volume days, max and ladder
            days, deload and retest every 4th week. Every number recalibrates from your all-out
            sets.
          </Text>
          <TextInput
            value={maxText}
            onChangeText={setMaxText}
            keyboardType="numeric"
            placeholder="e.g. 30"
            placeholderTextColor={theme.textFaint}
            style={styles.input}
          />
          <Pressable
            onPress={() => valid && setPushMax(maxNum)}
            style={[styles.startBtn, !valid && { opacity: 0.4 }]}
          >
            <Text style={styles.startBtnText}>Start the program</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  const workingSets = plan!.sets.filter((s) => !s.isWarmup);
  const setsLabel =
    plan!.dayKind === 'pushLadder'
      ? `${workingSets.length} rungs`
      : `${workingSets.length}×${workingSets[0].amrap ? `${workingSets[0].targetReps}+` : workingSets[0].targetReps}`;
  const restLabel = workingSets[0]
    ? `${Math.floor(workingSets[0].restSecAfter / 60)}:${(workingSets[0].restSecAfter % 60).toString().padStart(2, '0')}`
    : '—';
  const weekFraction = (push.week - 1 + Math.min(push.sessionInWeek, 3) / 3) / 4;
  const deloadInDays = (4 - push.week) * 7 || 0;
  const goal = computePushGoal(push, todayIso());

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
            CYCLE {push.cycle} · WEEK {push.week}
          </Text>
        </View>
      </View>
      <View style={styles.mottoRow}>
        <ModeMark mode="pushups" size={15} color={theme.push} />
        <Text style={styles.mottoText}>{modeIdentity('pushups').motto}</Text>
      </View>

      <ReadinessCard readiness={readinessInfo} accent={theme.push} />

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
            <Text style={[type.kicker, { color: theme.push }]}>{plan!.title.toUpperCase()}</Text>
            <Pressable onPress={() => setWhyOpen(true)} style={styles.whyPill}>
              <Text style={styles.whyPillText}>Why?</Text>
            </Pressable>
          </View>
          <View style={styles.statRow3}>
            <View>
              <Text style={[styles.statBig, mono]}>{setsLabel}</Text>
              <Text style={styles.statCaption}>sets × reps</Text>
            </View>
            <View>
              <Text style={[styles.statBig, mono]}>{restLabel}</Text>
              <Text style={styles.statCaption}>rest</Text>
            </View>
          </View>
          <View style={styles.readinessRow}>
            {READINESS.map((r) => (
              <Pressable
                key={r.key}
                onPress={() => setReadiness(r.key)}
                style={[
                  styles.readinessChip,
                  effectiveReadiness === r.key && { backgroundColor: theme.push, borderColor: theme.push },
                ]}
              >
                <Text style={[styles.readinessChipText, effectiveReadiness === r.key && { color: '#FFF' }]}>
                  {r.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable onPress={() => workout.start(plan!, effectiveReadiness)} style={styles.startBtn}>
            <Text style={styles.startBtnText}>{modeIdentity('pushups').verb}</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.ringCard}>
        <ProgressRing size={52} stroke={5} fraction={weekFraction} color={theme.push} />
        <View style={{ flex: 1 }}>
          <Text style={styles.ringTitle}>Week {push.week} of 4</Text>
          <Text style={styles.ringSub}>
            {deloadInDays > 0 ? `Deload in ~${deloadInDays} days` : 'Deload week — retest coming up'}
          </Text>
        </View>
      </View>

      <View style={styles.statPairRow}>
        <View style={styles.statTile}>
          <Text style={styles.statTileLabel}>BEST SET</Text>
          <Text style={[styles.statTileValue, mono]}>{push.bestMaxSet} reps</Text>
        </View>
        <View style={styles.statTile}>
          <Text style={styles.statTileLabel}>NEXT GOAL</Text>
          <Text style={[styles.statTileValue, mono]}>
            {goal ? `${goal.targetValue} · ${goal.etaMonth}` : '100 ✓'}
          </Text>
        </View>
      </View>

      {!doneToday ? (
        <View style={styles.whyCard}>
          <Text style={styles.whyLabel}>Why this workout</Text>
          <Text style={styles.whyText}>{plan!.why}</Text>
        </View>
      ) : null}

      <Sheet visible={whyOpen} onClose={() => setWhyOpen(false)} title="Why this workout">
        <Text style={styles.sheetLead}>{plan?.why}</Text>
        <Text style={styles.sheetBody}>{plan?.whyDetail}</Text>
      </Sheet>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: theme.pad, gap: 12, paddingBottom: 120 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  mottoRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: -6 },
  mottoText: { color: theme.textFaint, fontSize: 12.5, fontWeight: '500', letterSpacing: 0.1 },
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
    gap: 8,
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
  statRow3: { flexDirection: 'row', gap: 24, marginTop: 8 },
  statBig: { fontSize: 25, fontWeight: '600', color: theme.text },
  statCaption: { fontSize: 11, color: theme.textFaint, marginTop: 2 },
  readinessRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  readinessChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: theme.cardMuted,
    borderWidth: 1,
    borderColor: theme.border,
  },
  readinessChipText: { color: theme.textDim, fontSize: 12.5, fontWeight: '600' },
  startBtn: {
    marginTop: 12,
    backgroundColor: theme.push,
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
  },
  startBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  doneCheck: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: theme.good,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneCheckText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
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
  statTileValue: { fontSize: 18, fontWeight: '600', color: theme.text, marginTop: 4 },
  whyCard: { backgroundColor: '#EEE7F4', borderRadius: theme.radius, padding: 16, gap: 4 },
  whyLabel: { color: theme.push, fontSize: 12, fontWeight: '700' },
  whyText: { color: theme.textDim, fontSize: 12.5, lineHeight: 19 },
  setupLead: { fontSize: 17, fontWeight: '700', color: theme.text, marginTop: 4 },
  setupBody: { fontSize: 13, lineHeight: 20, color: theme.textDim },
  input: {
    backgroundColor: theme.cardMuted,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    color: theme.text,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 17,
    marginTop: 6,
  },
  sheetLead: { fontSize: 14.5, lineHeight: 21.5, color: theme.text, fontWeight: '600', marginBottom: 8 },
  sheetBody: { fontSize: 13.5, lineHeight: 20.5, color: theme.textDim },
});
