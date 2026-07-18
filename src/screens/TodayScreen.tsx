import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { generateSession } from '../engine/generator';
import { Effort, LoggedSession, Readiness, SessionPlan } from '../engine/types';
import { useStore } from '../hooks/useStore';
import { theme, mono, type } from '../theme';
import { WhyCard } from '../components/WhyCard';
import { SessionPlayer } from '../components/SessionPlayer';
import { ManualLog } from '../components/ManualLog';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const READINESS: Array<{ key: Readiness; label: string }> = [
  { key: 'good', label: 'Good' },
  { key: 'ok', label: 'OK' },
  { key: 'rough', label: 'Rough' },
];

const EFFORTS: Array<{ key: Effort; label: string; hint: string }> = [
  { key: 'easy', label: 'Easy', hint: '3+ reps left in the tank' },
  { key: 'right', label: 'Right', hint: '1–2 reps left' },
  { key: 'grind', label: 'Grind', hint: 'nothing left' },
];

export function TodayScreen() {
  const { store, completeSession } = useStore();
  const [readiness, setReadiness] = useState<Readiness | undefined>();
  const [phase, setPhase] = useState<'idle' | 'active' | 'effort' | 'summary' | 'manual'>('idle');
  const [actuals, setActuals] = useState<(number | null)[]>([]);
  const [cursor, setCursor] = useState(0);
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
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
    const nextActuals = [...actuals];
    nextActuals[cursor] = set.targetReps;
    setActuals(nextActuals);
    const isLast = cursor === activePlan.sets.length - 1;
    if (isLast) {
      setRestEndsAt(null);
      if (hasWeightedSets) setPhase('effort');
      else finish(undefined, nextActuals);
    } else {
      if (set.restSecAfter > 0) setRestEndsAt(Date.now() + set.restSecAfter * 1000);
      setCursor(cursor + 1);
    }
  };

  const finish = (chosenEffort?: Effort, finalActuals?: (number | null)[]) => {
    const acts = (finalActuals ?? actuals).map((v) => v ?? 0);
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

  const doneThisWeek = useMemo(() => {
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    return store.sessions.filter((s) => new Date(s.date) >= monday).length;
  }, [store.sessions]);

  if (phase === 'manual') {
    return (
      <ManualLog
        defaultLoadKg={profile.equipment.fixedLoadKg}
        onCancel={resetToIdle}
        onSave={(session) => {
          const reps = session.sets.reduce((sum, s) => sum + s.actualReps, 0);
          const { prCount } = completeSession(session);
          setSummary({ reps, prCount });
          setPhase('summary');
        }}
      />
    );
  }

  if (phase === 'summary' && summary) {
    return (
      <View style={[styles.screen, styles.center]}>
        {summary.prCount > 0 ? (
          <>
            <Text style={styles.prEmoji}>🎉</Text>
            <Text style={styles.prTitle}>Personal record</Text>
          </>
        ) : (
          <Text style={type.title}>Session done</Text>
        )}
        <Text style={[type.giant, mono]}>{summary.reps}</Text>
        <Text style={styles.summarySub}>
          reps banked · lifetime <Text style={mono}>{store.lifetimeReps}</Text>
        </Text>
        <Pressable onPress={resetToIdle} style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>Nice</Text>
        </Pressable>
      </View>
    );
  }

  if (phase === 'effort') {
    return (
      <View style={[styles.screen, styles.center]}>
        <Text style={type.title}>How was the last working set?</Text>
        <View style={{ gap: 10, width: '100%', maxWidth: 420 }}>
          {EFFORTS.map((e) => (
            <Pressable key={e.key} onPress={() => finish(e.key)} style={styles.effortBtn}>
              <Text style={styles.effortLabel}>{e.label}</Text>
              <Text style={styles.effortHint}>{e.hint}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.effortNote}>
          This is how the program decides your next session — answer honestly.
        </Text>
      </View>
    );
  }

  if (phase === 'active') {
    return (
      <SessionPlayer
        plan={activePlan}
        actuals={actuals}
        cursor={cursor}
        restEndsAt={restEndsAt}
        onCompleteCurrent={completeCurrent}
        onAdjust={(i, delta) =>
          setActuals((a) => {
            const next = [...a];
            next[i] = Math.max(0, (next[i] ?? 0) + delta);
            return next;
          })
        }
        onSkipRest={() => setRestEndsAt(null)}
        onExtendRest={() => setRestEndsAt((t) => (t ? t + 30_000 : t))}
        onRestDone={() => setRestEndsAt(null)}
        onEndEarly={() => (hasWeightedSets ? setPhase('effort') : finish())}
      />
    );
  }

  // idle
  const workingSets = plan.sets.filter((s) => !s.isWarmup);
  const maxLoad = Math.max(...plan.sets.map((s) => s.loadKg));
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scrollContent}>
      <View style={styles.chipRow}>
        <View style={styles.chip}>
          <Text style={styles.chipText}>Cycle {plan.cycle}</Text>
        </View>
        <View style={styles.chip}>
          <Text style={styles.chipText}>Week {plan.week}/4</Text>
        </View>
        <View style={styles.chip}>
          <Text style={styles.chipText}>{Math.min(doneThisWeek + 1, 3)}/3 this week</Text>
        </View>
      </View>
      <Text style={type.hero}>{plan.title}</Text>
      <Text style={styles.subtitle}>
        <Text style={[mono, { color: theme.text }]}>{workingSets.length}</Text> working sets
        {maxLoad > 0 ? (
          <>
            {' '}·{' '}
            <Text style={[mono, { color: theme.text }]}>+{maxLoad} kg</Text>
          </>
        ) : (
          ' · bodyweight'
        )}
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
            <Text
              style={[
                styles.readinessText,
                readiness === r.key && { color: theme.onAccent },
              ]}
            >
              {r.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <Pressable onPress={start} style={styles.primaryBtn}>
        <Text style={styles.primaryBtnText}>Start session</Text>
      </Pressable>
      <Pressable onPress={() => setPhase('manual')} style={styles.linkBtn}>
        <Text style={styles.linkText}>Log a workout you did on your own</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  scrollContent: { padding: theme.pad, gap: 16, paddingBottom: 40 },
  center: { alignItems: 'center', justifyContent: 'center', padding: 28, gap: 14 },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: {
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: { color: theme.textDim, fontSize: 12, fontWeight: '600' },
  subtitle: { color: theme.textDim, fontSize: 15, marginTop: -8 },
  primaryBtn: {
    backgroundColor: theme.accent,
    borderRadius: theme.radius,
    paddingVertical: 17,
    alignItems: 'center',
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  primaryBtnText: { color: theme.onAccent, fontSize: 17, fontWeight: '800' },
  readinessRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  readinessLabel: { color: theme.textFaint, fontSize: 13, marginRight: 4 },
  readinessBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
  },
  readinessActive: { backgroundColor: theme.accent, borderColor: theme.accent },
  readinessText: { color: theme.textDim, fontSize: 13, fontWeight: '600' },
  linkBtn: { alignItems: 'center', paddingVertical: 10 },
  linkText: { color: theme.textFaint, fontSize: 13 },
  prEmoji: { fontSize: 40 },
  prTitle: { color: theme.accent, fontSize: 18, fontWeight: '800' },
  summarySub: { color: theme.textDim, fontSize: 14 },
  effortBtn: {
    backgroundColor: theme.card,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 18,
    alignItems: 'center',
  },
  effortLabel: { color: theme.text, fontSize: 17, fontWeight: '700' },
  effortHint: { color: theme.textDim, fontSize: 13, marginTop: 2 },
  effortNote: { color: theme.textFaint, fontSize: 12, textAlign: 'center', maxWidth: 300 },
});
