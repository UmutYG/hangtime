import React, { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Effort, LoggedSession, PlannedSet, Profile, SessionPlan } from '../engine/types';
import { theme, mono, type } from '../theme';
import { ProgressRing } from './ProgressRing';

const haptic = (kind: 'tap' | 'success') => {
  if (Platform.OS === 'web') return;
  if (kind === 'success') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  else void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
};

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function setLabel(set: PlannedSet, workingIndex: number, total: number): string {
  if (set.ladder) return `Ladder ${set.ladder.ladderIndex} · Rung ${set.ladder.rung}`;
  return `Set ${workingIndex} of ${total}`;
}

const RING_CIRC = 2 * Math.PI * ((180 - 7) / 2);

const EFFORTS: Array<{ key: Effort; label: string; hint: string }> = [
  { key: 'easy', label: 'Easy', hint: '3+ reps left' },
  { key: 'right', label: 'Right', hint: '1–2 reps left' },
  { key: 'grind', label: 'Grind', hint: 'nothing left' },
];

export function WorkoutOverlay({
  plan,
  profile,
  readiness,
  onCancel,
  onSave,
}: {
  plan: SessionPlan;
  profile: Profile;
  readiness?: string;
  onCancel: () => void;
  onSave: (session: LoggedSession) => { prCount: number };
}) {
  const workingIdx = useMemo(
    () => plan.sets.map((_, i) => i).filter((i) => !plan.sets[i].isWarmup),
    [plan]
  );
  const hasWarmup = plan.sets.some((s) => s.isWarmup);
  const hasWeighted = plan.sets.some((s) => !s.isWarmup && s.loadKg > 0);

  const [warmupDone, setWarmupDone] = useState(!hasWarmup);
  const [cursor, setCursor] = useState(0); // index into workingIdx
  const [actuals, setActuals] = useState<Record<number, number>>({});
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [effort, setEffort] = useState<Effort>('right');
  const [saved, setSaved] = useState<{ prCount: number } | null>(null);

  const currentFullIdx = workingIdx[cursor];
  const currentSet = currentFullIdx !== undefined ? plan.sets[currentFullIdx] : undefined;
  const [curReps, setCurReps] = useState(currentSet?.targetReps ?? 0);

  useEffect(() => {
    setCurReps(currentSet?.targetReps ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor]);

  const resting = restEndsAt !== null;
  useEffect(() => {
    if (!resting) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [resting]);
  const restRemaining = resting ? Math.max(0, Math.ceil((restEndsAt! - now) / 1000)) : 0;
  useEffect(() => {
    if (resting && restRemaining === 0) {
      haptic('success');
      setRestEndsAt(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resting, restRemaining === 0]);

  const finished = warmupDone && cursor >= workingIdx.length;

  const completeWarmup = () => {
    haptic('tap');
    const patch: Record<number, number> = {};
    plan.sets.forEach((s, i) => {
      if (s.isWarmup) patch[i] = s.targetReps;
    });
    setActuals((a) => ({ ...a, ...patch }));
    setWarmupDone(true);
  };

  const logSet = () => {
    haptic('success');
    const i = currentFullIdx!;
    setActuals((a) => ({ ...a, [i]: curReps }));
    const isLastWorking = cursor === workingIdx.length - 1;
    const rest = plan.sets[i].restSecAfter;
    if (!isLastWorking && rest > 0) setRestEndsAt(Date.now() + rest * 1000);
    setCursor((c) => c + 1);
  };

  const buildSession = (): LoggedSession => ({
    id: `${plan.dayKind}-${Date.now()}`,
    date: new Date().toISOString().slice(0, 10),
    dayKind: plan.dayKind,
    cycle: plan.cycle,
    week: plan.week,
    readiness: readiness as LoggedSession['readiness'],
    lastSetEffort: hasWeighted ? effort : undefined,
    progressionExempt: plan.progressionExempt,
    sets: plan.sets.map((s, i) => ({
      targetReps: s.targetReps,
      actualReps: actuals[i] ?? s.targetReps,
      loadKg: s.loadKg,
      isWarmup: s.isWarmup,
    })),
  });

  const totalReps = Object.values(actuals).reduce((sum, r) => sum + r, 0);
  const doneWorkingCount = workingIdx.filter((i) => actuals[i] !== undefined).length;
  const topSet = useMemo(() => {
    let best: { load: number; reps: number } | null = null;
    workingIdx.forEach((i) => {
      const reps = actuals[i];
      if (reps === undefined) return;
      const load = plan.sets[i].loadKg;
      if (!best || load > best.load || (load === best.load && reps > best.reps)) {
        best = { load, reps };
      }
    });
    return best as { load: number; reps: number } | null;
  }, [actuals, workingIdx, plan.sets]);

  const save = () => {
    haptic('success');
    const result = onSave(buildSession());
    setSaved(result);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.topRow}>
        <Pressable onPress={onCancel} hitSlop={10}>
          <Text style={styles.cancel}>{saved ? 'Close' : 'Cancel'}</Text>
        </Pressable>
        <Text style={type.kickerDim}>{plan.title}</Text>
        <View style={{ width: 44 }} />
      </View>

      {!finished ? (
        <View style={styles.dotsRow}>
          {workingIdx.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                actuals[workingIdx[i]] !== undefined && styles.dotDone,
                i === cursor && !resting && styles.dotCurrent,
              ]}
            />
          ))}
        </View>
      ) : null}

      {!warmupDone ? (
        <View style={styles.centerFlex}>
          <Text style={type.kicker}>Warm-up</Text>
          <View style={styles.warmupCard}>
            {plan.sets
              .filter((s) => s.isWarmup)
              .map((s, i, arr) => (
                <View key={i} style={[styles.warmupRow, i === arr.length - 1 && { borderBottomWidth: 0 }]}>
                  <Text style={styles.warmupLabel}>{s.loadKg > 0 ? `+${s.loadKg} kg` : 'Bodyweight'}</Text>
                  <Text style={[styles.warmupValue, mono]}>× {s.targetReps}</Text>
                </View>
              ))}
          </View>
          <Text style={styles.hint}>Easy pace — these prime the pattern without eating into your top set.</Text>
          <Pressable onPress={completeWarmup} style={styles.darkBtn}>
            <Text style={styles.darkBtnText}>Warm-up done</Text>
          </Pressable>
        </View>
      ) : resting ? (
        <View style={styles.centerFlex}>
          <Text style={type.kickerDim}>Rest</Text>
          <View style={styles.ringWrap}>
            <ProgressRing size={180} stroke={7} fraction={1 - restRemaining / Math.max(1, plan.sets[workingIdx[cursor - 1]]?.restSecAfter ?? 1)} />
            <View style={styles.ringCenter}>
              <Text style={[styles.ringTime, mono]}>{fmtTime(restRemaining)}</Text>
            </View>
          </View>
          {currentSet ? (
            <Text style={styles.nextUp}>
              Next: <Text style={styles.nextUpBold}>{setLabel(currentSet, cursor + 1, workingIdx.length)} — {currentSet.amrap ? `${currentSet.targetReps}+` : currentSet.targetReps} reps{currentSet.loadKg > 0 ? ` · +${currentSet.loadKg} kg` : ''}</Text>
            </Text>
          ) : null}
          <View style={styles.restBtnRow}>
            <Pressable onPress={() => setRestEndsAt((t) => (t ? t + 30_000 : t))} style={styles.lightBtn}>
              <Text style={styles.lightBtnText}>+30 s</Text>
            </Pressable>
            <Pressable onPress={() => setRestEndsAt(null)} style={[styles.darkBtn, { flex: 1 }]}>
              <Text style={styles.darkBtnText}>Skip rest</Text>
            </Pressable>
          </View>
        </View>
      ) : !finished && currentSet ? (
        <View style={styles.centerFlex}>
          <Text style={type.kicker}>{setLabel(currentSet, cursor + 1, workingIdx.length).toUpperCase()}</Text>
          {currentSet.amrap ? (
            <Text style={styles.hint}>All-out set — this recalibrates your estimate</Text>
          ) : null}
          <View style={styles.repStepper}>
            <Pressable onPress={() => setCurReps((r) => Math.max(0, r - 1))} style={styles.stepBtn}>
              <Text style={styles.stepBtnText}>−</Text>
            </Pressable>
            <View style={{ alignItems: 'center', width: 130 }}>
              <Text style={[type.giant, mono]}>{curReps}</Text>
              <Text style={styles.repsWord}>reps done</Text>
            </View>
            <Pressable onPress={() => setCurReps((r) => r + 1)} style={styles.stepBtn}>
              <Text style={styles.stepBtnText}>+</Text>
            </Pressable>
          </View>
          <Text style={styles.targetLine}>
            target {currentSet.amrap ? `${currentSet.targetReps}+` : currentSet.targetReps}
            {currentSet.loadKg > 0 ? ` · +${currentSet.loadKg} kg` : ''}
          </Text>
          <Pressable onPress={logSet} style={styles.accentBtn}>
            <Text style={styles.accentBtnText}>Log set</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.centerFlex} showsVerticalScrollIndicator={false}>
          <View style={styles.checkCircle}>
            <Text style={styles.checkText}>✓</Text>
          </View>
          <Text style={styles.doneTitle}>{saved ? 'Saved' : 'Session complete'}</Text>
          {saved && saved.prCount > 0 ? (
            <Text style={styles.prTag}>🎉 {saved.prCount === 1 ? 'New personal record' : `${saved.prCount} new personal records`}</Text>
          ) : null}
          <View style={styles.statCard}>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Sets</Text>
              <Text style={[styles.statValue, mono]}>{doneWorkingCount}</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Total reps</Text>
              <Text style={[styles.statValue, mono]}>{totalReps}</Text>
            </View>
            {topSet ? (
              <View style={[styles.statRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.statLabel}>Top set</Text>
                <Text style={[styles.statValue, mono]}>
                  {topSet.load > 0 ? `+${topSet.load} kg × ${topSet.reps}` : `${topSet.reps} reps`}
                </Text>
              </View>
            ) : null}
          </View>
          {!saved && hasWeighted ? (
            <View style={{ width: '100%', marginTop: 14, gap: 8 }}>
              <Text style={styles.effortPrompt}>How was the last working set?</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {EFFORTS.map((e) => (
                  <Pressable
                    key={e.key}
                    onPress={() => setEffort(e.key)}
                    style={[styles.effortChip, effort === e.key && styles.effortChipActive]}
                  >
                    <Text style={[styles.effortChipText, effort === e.key && { color: theme.onAccent }]}>
                      {e.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>
      )}

      {finished && !saved ? (
        <Pressable onPress={save} style={styles.accentBtn}>
          <Text style={styles.accentBtnText}>Save session</Text>
        </Pressable>
      ) : finished && saved ? (
        <Pressable onPress={onCancel} style={styles.darkBtn}>
          <Text style={styles.darkBtnText}>Done</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg, padding: 24, paddingTop: 8, gap: 6 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cancel: { fontSize: 14, color: theme.textFaint, width: 60 },
  dotsRow: { flexDirection: 'row', gap: 6, justifyContent: 'center', flexWrap: 'wrap', marginTop: 18 },
  dot: { width: 30, height: 5, borderRadius: 3, backgroundColor: theme.border },
  dotDone: { backgroundColor: theme.good },
  dotCurrent: { backgroundColor: theme.accent },
  centerFlex: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  warmupCard: {
    marginTop: 16,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: theme.radiusLg,
    paddingHorizontal: 20,
    width: '100%',
  },
  warmupRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: theme.cardMuted,
  },
  warmupLabel: { fontSize: 15, color: theme.textDim },
  warmupValue: { fontSize: 15, fontWeight: '600', color: theme.text },
  hint: { fontSize: 12.5, color: theme.textFaint, textAlign: 'center', lineHeight: 19, paddingHorizontal: 20, marginTop: 8 },
  repStepper: { flexDirection: 'row', alignItems: 'center', gap: 24, marginTop: 24 },
  stepBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { fontSize: 26, color: theme.textDim },
  repsWord: { fontSize: 12, color: theme.textFaint, marginTop: 2 },
  targetLine: { fontSize: 13, color: theme.textFaint, marginTop: 10 },
  ringWrap: { marginTop: 20, width: 180, height: 180, alignItems: 'center', justifyContent: 'center' },
  ringCenter: { position: 'absolute' },
  ringTime: { fontSize: 44, fontWeight: '600', letterSpacing: -1, color: theme.text },
  nextUp: { fontSize: 13.5, color: theme.textDim, marginTop: 18, textAlign: 'center' },
  nextUpBold: { fontWeight: '700', color: theme.text },
  restBtnRow: { flexDirection: 'row', gap: 10, width: '100%', marginTop: 24 },
  checkCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.good,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: { color: theme.onAccent, fontSize: 20, fontWeight: '700' },
  doneTitle: { fontSize: 22, fontWeight: '700', color: theme.text, marginTop: 12, letterSpacing: -0.3 },
  prTag: { fontSize: 14, fontWeight: '700', color: theme.accentDark, marginTop: 6 },
  statCard: {
    marginTop: 18,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: theme.radiusLg,
    paddingHorizontal: 20,
    width: '100%',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.cardMuted,
  },
  statLabel: { fontSize: 14, color: theme.textDim },
  statValue: { fontSize: 14, fontWeight: '600', color: theme.text },
  effortPrompt: { fontSize: 13, color: theme.textDim, textAlign: 'center' },
  effortChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
  },
  effortChipActive: { backgroundColor: theme.accent, borderColor: theme.accent },
  effortChipText: { fontSize: 13, fontWeight: '600', color: theme.textDim },
  darkBtn: {
    backgroundColor: theme.dark,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 18,
    width: '100%',
  },
  darkBtnText: { color: theme.onDark, fontSize: 16, fontWeight: '700' },
  lightBtn: {
    flex: 1,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
  },
  lightBtnText: { color: theme.textDim, fontSize: 15, fontWeight: '600' },
  accentBtn: {
    backgroundColor: theme.accent,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 18,
    width: '100%',
  },
  accentBtnText: { color: theme.onAccent, fontSize: 16, fontWeight: '700' },
});
