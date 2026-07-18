import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { generateSession } from '../engine/generator';
import { LoggedSession, Readiness, SessionPlan, Effort } from '../engine/types';
import { useStore } from '../hooks/useStore';
import { theme, mono } from '../theme';
import { WhyCard } from '../components/WhyCard';
import { SetRow } from '../components/SetRow';
import { RestTimer } from '../components/RestTimer';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const READINESS: Array<{ key: Readiness; label: string; emoji: string }> = [
  { key: 'good', label: 'Good', emoji: '⚡' },
  { key: 'ok', label: 'OK', emoji: '😐' },
  { key: 'rough', label: 'Rough', emoji: '🥱' },
];

const EFFORTS: Array<{ key: Effort; label: string; hint: string }> = [
  { key: 'easy', label: 'Easy', hint: '3+ reps left' },
  { key: 'right', label: 'Right', hint: '1–2 reps left' },
  { key: 'grind', label: 'Grind', hint: 'nothing left' },
];

export function TodayScreen() {
  const { store, completeSession } = useStore();
  const [readiness, setReadiness] = useState<Readiness | undefined>();
  const [phase, setPhase] = useState<'idle' | 'active' | 'effort' | 'summary'>('idle');
  const [actuals, setActuals] = useState<(number | null)[]>([]);
  const [cursor, setCursor] = useState(0);
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [effort, setEffort] = useState<Effort>('right');
  const [summary, setSummary] = useState<{ reps: number; prCount: number } | null>(null);
  const [planSnapshot, setPlanSnapshot] = useState<SessionPlan | null>(null);

  const profile = store.profile!;
  const plan = useMemo(
    () => generateSession(profile, store.state, todayIso(), readiness),
    [profile, store.state, readiness]
  );
  const activePlan = planSnapshot ?? plan;
  const hasWeightedSets = activePlan.sets.some((s) => !s.isWarmup && s.loadKg > 0);

  const start = () => {
    setPlanSnapshot(plan);
    setActuals(Array(plan.sets.length).fill(null));
    setCursor(0);
    setRestEndsAt(null);
    setPhase('active');
  };

  const completeCurrent = () => {
    const set = activePlan.sets[cursor];
    setActuals((a) => {
      const next = [...a];
      next[cursor] = set.targetReps;
      return next;
    });
    const isLast = cursor === activePlan.sets.length - 1;
    if (isLast) {
      setRestEndsAt(null);
      setPhase(hasWeightedSets ? 'effort' : 'summary');
      if (!hasWeightedSets) finish(undefined, actualsWith(set.targetReps));
    } else {
      if (set.restSecAfter > 0) setRestEndsAt(Date.now() + set.restSecAfter * 1000);
      setCursor(cursor + 1);
    }
  };

  const actualsWith = (lastVal: number): number[] => {
    const a = [...actuals];
    a[cursor] = lastVal;
    return a.map((v, i) => v ?? (i < cursor ? activePlan.sets[i].targetReps : 0));
  };

  const finish = (chosenEffort?: Effort, finalActuals?: number[]) => {
    const acts = finalActuals ?? actuals.map((v) => v ?? 0);
    const session: LoggedSession = {
      id: `${todayIso()}-${activePlan.dayKind}-${Date.now()}`,
      date: todayIso(),
      dayKind: activePlan.dayKind,
      cycle: activePlan.cycle,
      week: activePlan.week,
      readiness,
      lastSetEffort: chosenEffort,
      progressionExempt: activePlan.progressionExempt,
      sets: activePlan.sets.map((s, i) => ({
        targetReps: s.targetReps,
        actualReps: acts[i] ?? 0,
        loadKg: s.loadKg,
        isWarmup: s.isWarmup,
      })),
    };
    const reps = session.sets.reduce((sum, s) => sum + s.actualReps, 0);
    const { prCount } = completeSession(session);
    setSummary({ reps, prCount });
    setPhase('summary');
  };

  const resetToIdle = () => {
    setPhase('idle');
    setReadiness(undefined);
    setSummary(null);
    setPlanSnapshot(null);
    setRestEndsAt(null);
  };

  const doneThisWeek = store.sessions.filter((s) => {
    const d = new Date(s.date);
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    return d >= monday;
  }).length;

  if (phase === 'summary' && summary) {
    return (
      <View style={[styles.screen, styles.center]}>
        {summary.prCount > 0 ? (
          <>
            <Text style={styles.prBig}>🎉 PR!</Text>
            <Text style={styles.prSub}>
              {summary.prCount === 1 ? 'New personal record' : `${summary.prCount} new personal records`}
            </Text>
          </>
        ) : (
          <Text style={styles.summaryTitle}>Session done</Text>
        )}
        <Text style={[styles.summaryReps, mono]}>{summary.reps}</Text>
        <Text style={styles.summarySub}>reps banked · lifetime {store.lifetimeReps}</Text>
        <Pressable onPress={resetToIdle} style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>Nice</Text>
        </Pressable>
      </View>
    );
  }

  if (phase === 'effort') {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={styles.summaryTitle}>How was the last working set?</Text>
        <View style={{ gap: 10, width: '100%', maxWidth: 420 }}>
          {EFFORTS.map((e) => (
            <Pressable
              key={e.key}
              onPress={() => {
                setEffort(e.key);
                finish(e.key);
              }}
              style={styles.effortBtn}
            >
              <Text style={styles.effortLabel}>{e.label}</Text>
              <Text style={styles.effortHint}>{e.hint}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.effortNote}>
          This is how the program knows when to add weight — answer honestly.
        </Text>
      </View>
    );
  }

  if (phase === 'active') {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.kicker}>
          {activePlan.title.toUpperCase()} · SET {Math.min(cursor + 1, activePlan.sets.length)}/
          {activePlan.sets.length}
        </Text>
        {restEndsAt ? (
          <RestTimer
            endsAt={restEndsAt}
            onDone={() => setRestEndsAt(null)}
            onSkip={() => setRestEndsAt(null)}
            onExtend={() => setRestEndsAt((t) => (t ? t + 30_000 : t))}
          />
        ) : null}
        <View style={{ gap: 8 }}>
          {activePlan.sets.map((s, i) => (
            <SetRow
              key={i}
              set={s}
              index={activePlan.sets.slice(0, i + 1).filter((x) => !x.isWarmup).length}
              state={i < cursor ? 'done' : i === cursor && !restEndsAt ? 'current' : i === cursor ? 'current' : 'upcoming'}
              actualReps={actuals[i]}
              onComplete={completeCurrent}
              onAdjust={(delta) =>
                setActuals((a) => {
                  const next = [...a];
                  next[i] = Math.max(0, (next[i] ?? 0) + delta);
                  return next;
                })
              }
            />
          ))}
        </View>
        <Pressable
          onPress={() => (hasWeightedSets ? setPhase('effort') : finish())}
          style={styles.endEarly}
        >
          <Text style={styles.endEarlyText}>End session early</Text>
        </Pressable>
      </ScrollView>
    );
  }

  // idle
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent}>
      <Text style={styles.kicker}>
        CYCLE {plan.cycle} · WEEK {plan.week} · SESSION {doneThisWeek + 1 > 3 ? 3 : doneThisWeek + 1}/3 THIS WEEK
      </Text>
      <Text style={styles.title}>{plan.title}</Text>
      <Text style={styles.subtitle}>
        {plan.sets.filter((s) => !s.isWarmup).length} working sets
        {plan.sets.some((s) => s.loadKg > 0) ? ` · up to +${Math.max(...plan.sets.map((s) => s.loadKg))} kg` : ' · bodyweight'}
      </Text>
      <WhyCard why={plan.why} detail={plan.whyDetail} />
      <View style={styles.readinessRow}>
        <Text style={styles.readinessLabel}>Feeling</Text>
        {READINESS.map((r) => (
          <Pressable
            key={r.key}
            onPress={() => setReadiness(readiness === r.key ? undefined : r.key)}
            style={[styles.readinessBtn, readiness === r.key && styles.readinessActive]}
          >
            <Text style={styles.readinessEmoji}>{r.emoji}</Text>
            <Text style={[styles.readinessText, readiness === r.key && { color: theme.text }]}>
              {r.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <Pressable onPress={start} style={styles.primaryBtn}>
        <Text style={styles.primaryBtnText}>Start session</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  scrollContent: { padding: theme.pad, gap: 14, paddingBottom: 40 },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 },
  kicker: { color: theme.textFaint, fontSize: 11, fontWeight: '700', letterSpacing: 1.4 },
  title: { color: theme.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: theme.textDim, fontSize: 14, marginTop: -8 },
  primaryBtn: {
    backgroundColor: theme.accent,
    borderRadius: theme.radius,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 6,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
  },
  primaryBtnText: { color: theme.onAccent, fontSize: 17, fontWeight: '800' },
  readinessRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  readinessLabel: { color: theme.textFaint, fontSize: 13, marginRight: 4 },
  readinessBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
  },
  readinessActive: { borderColor: theme.accent, backgroundColor: theme.cardRaised },
  readinessEmoji: { fontSize: 14 },
  readinessText: { color: theme.textDim, fontSize: 13, fontWeight: '600' },
  endEarly: { alignItems: 'center', paddingVertical: 12 },
  endEarlyText: { color: theme.textFaint, fontSize: 13 },
  prBig: { fontSize: 44 },
  prSub: { color: theme.accent, fontSize: 16, fontWeight: '700' },
  summaryTitle: { color: theme.text, fontSize: 22, fontWeight: '800' },
  summaryReps: { color: theme.text, fontSize: 64, fontWeight: '200' },
  summarySub: { color: theme.textDim, fontSize: 14 },
  effortBtn: {
    backgroundColor: theme.card,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 16,
    alignItems: 'center',
  },
  effortLabel: { color: theme.text, fontSize: 17, fontWeight: '700' },
  effortHint: { color: theme.textDim, fontSize: 13, marginTop: 2 },
  effortNote: { color: theme.textFaint, fontSize: 12, textAlign: 'center', maxWidth: 300 },
});
