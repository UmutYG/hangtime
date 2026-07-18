import React, { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { PlannedSet, SessionPlan } from '../engine/types';
import { theme, mono, type } from '../theme';

const haptic = (kind: 'tap' | 'success') => {
  if (Platform.OS === 'web') return;
  if (kind === 'success') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  else void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
};

function setLabel(set: PlannedSet, workingIndex: number): string {
  if (set.isWarmup) return 'Warm-up';
  if (set.ladder) return `Ladder ${set.ladder.ladderIndex} · Rung ${set.ladder.rung}`;
  return `Set ${workingIndex}`;
}

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function SessionPlayer({
  plan,
  actuals,
  cursor,
  restEndsAt,
  onCompleteCurrent,
  onAdjust,
  onSkipRest,
  onExtendRest,
  onRestDone,
  onEndEarly,
  onDiscard,
}: {
  plan: SessionPlan;
  actuals: (number | null)[];
  cursor: number;
  restEndsAt: number | null;
  onCompleteCurrent: () => void;
  onAdjust: (index: number, delta: number) => void;
  onSkipRest: () => void;
  onExtendRest: () => void;
  onRestDone: () => void;
  onEndEarly: () => void;
  onDiscard: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  const resting = restEndsAt !== null;

  useEffect(() => {
    if (!resting) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [resting]);

  const remaining = resting ? Math.max(0, Math.ceil((restEndsAt! - now) / 1000)) : 0;
  useEffect(() => {
    if (resting && remaining === 0) {
      haptic('success');
      onRestDone();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resting, remaining === 0]);

  const current = plan.sets[cursor];
  const total = plan.sets.length;
  const doneCount = actuals.filter((a) => a !== null).length;
  const workingIndex = plan.sets.slice(0, cursor + 1).filter((s) => !s.isWarmup).length;
  const restTotal = cursor > 0 ? plan.sets[cursor - 1].restSecAfter : 0;
  const restFrac = resting && restTotal > 0 ? remaining / restTotal : 0;

  const totalReps = useMemo(
    () => actuals.reduce((sum: number, a) => sum + (a ?? 0), 0),
    [actuals]
  );

  return (
    <View style={styles.screen}>
      {/* progress header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={[type.kicker, { flex: 1 }]}>{plan.title}</Text>
          <Pressable onPress={onDiscard} hitSlop={12} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>✕</Text>
          </Pressable>
        </View>
        <View style={styles.progressRow}>
          {plan.sets.map((_, i) => (
            <View
              key={i}
              style={[
                styles.segment,
                i < doneCount && styles.segmentDone,
                i === cursor && !resting && styles.segmentCurrent,
              ]}
            />
          ))}
        </View>
        <Text style={styles.headerMeta}>
          <Text style={mono}>{doneCount}</Text>/{total} sets · <Text style={mono}>{totalReps}</Text>{' '}
          reps
        </Text>
      </View>

      {/* focus card */}
      {resting ? (
        <View style={[styles.focus, styles.focusRest]}>
          <Text style={[type.kicker, { color: theme.accent }]}>Rest</Text>
          <Text style={[type.giant, mono]}>{fmtTime(remaining)}</Text>
          <View style={styles.restBarTrack}>
            <View style={[styles.restBarFill, { width: `${Math.round(restFrac * 100)}%` }]} />
          </View>
          <View style={styles.rowGap}>
            <Pressable onPress={onExtendRest} style={styles.ghostBtn}>
              <Text style={styles.ghostBtnText}>+30 s</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                haptic('tap');
                onSkipRest();
              }}
              style={styles.solidBtn}
            >
              <Text style={styles.solidBtnText}>Skip</Text>
            </Pressable>
          </View>
          <Text style={styles.upNext}>
            Up next: {setLabel(current, workingIndex)} — {current.amrap ? `${current.targetReps}+` : current.targetReps} reps
            {current.loadKg > 0 ? ` · +${current.loadKg} kg` : ''}
          </Text>
        </View>
      ) : (
        <View style={styles.focus}>
          <Text style={[type.kicker, current.isWarmup ? null : { color: theme.accent }]}>
            {setLabel(current, workingIndex)}
          </Text>
          <View style={styles.repRow}>
            <Text style={[type.giant, mono]}>
              {current.amrap ? `${current.targetReps}+` : current.targetReps}
            </Text>
            <View style={styles.repMeta}>
              <Text style={styles.repsWord}>reps</Text>
              <View style={[styles.loadPill, current.loadKg === 0 && styles.loadPillBw]}>
                <Text style={[styles.loadPillText, current.loadKg === 0 && { color: theme.textDim }]}>
                  {current.loadKg > 0 ? `+${current.loadKg} kg` : 'bodyweight'}
                </Text>
              </View>
            </View>
          </View>
          {current.note ? <Text style={styles.note}>{current.note}</Text> : null}
          <Pressable
            onPress={() => {
              haptic('success');
              onCompleteCurrent();
            }}
            style={styles.doneBtn}
          >
            <Text style={styles.doneBtnText}>Done</Text>
          </Pressable>
        </View>
      )}

      {/* set list */}
      <ScrollView style={styles.list} contentContainerStyle={{ gap: 6, paddingBottom: 30 }}>
        {plan.sets.map((s, i) => {
          const done = actuals[i] !== null;
          const isCurrent = i === cursor && !done;
          let wi = plan.sets.slice(0, i + 1).filter((x) => !x.isWarmup).length;
          return (
            <View
              key={i}
              style={[styles.row, isCurrent && styles.rowCurrent, done && styles.rowDone]}
            >
              <Text style={[styles.rowLabel, done && { color: theme.textFaint }]}>
                {setLabel(s, wi)}
              </Text>
              <Text style={[styles.rowTarget, mono, done && { color: theme.textFaint }]}>
                {s.amrap ? `${s.targetReps}+` : s.targetReps}
                {s.loadKg > 0 ? ` · +${s.loadKg}` : ''}
              </Text>
              {done ? (
                <View style={styles.stepper}>
                  <Pressable onPress={() => onAdjust(i, -1)} hitSlop={10} style={styles.stepBtn}>
                    <Text style={styles.stepText}>−</Text>
                  </Pressable>
                  <Text style={[styles.actual, mono]}>{actuals[i]}</Text>
                  <Pressable onPress={() => onAdjust(i, 1)} hitSlop={10} style={styles.stepBtn}>
                    <Text style={styles.stepText}>+</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={{ width: 86 }} />
              )}
            </View>
          );
        })}
        <Pressable onPress={onEndEarly} style={styles.endEarly}>
          <Text style={styles.endEarlyText}>End session early</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg, padding: theme.pad, gap: 14 },
  header: { gap: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  cancelBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { color: theme.textDim, fontSize: 13, fontWeight: '700' },
  progressRow: { flexDirection: 'row', gap: 4 },
  segment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: theme.cardRaised },
  segmentDone: { backgroundColor: theme.accent },
  segmentCurrent: { backgroundColor: theme.textFaint },
  headerMeta: { color: theme.textFaint, fontSize: 12 },
  focus: {
    backgroundColor: theme.card,
    borderRadius: theme.radiusLg,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 24,
    gap: 12,
  },
  focusRest: { borderColor: theme.accent, alignItems: 'center' },
  repRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 16 },
  repMeta: { paddingBottom: 18, gap: 8 },
  repsWord: { color: theme.textDim, fontSize: 16 },
  loadPill: {
    backgroundColor: theme.accent,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  loadPillBw: { backgroundColor: theme.cardRaised },
  loadPillText: { color: theme.onAccent, fontSize: 13, fontWeight: '700' },
  note: { color: theme.textDim, fontSize: 13, lineHeight: 19 },
  doneBtn: {
    backgroundColor: theme.accent,
    borderRadius: theme.radius,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 4,
  },
  doneBtnText: { color: theme.onAccent, fontSize: 18, fontWeight: '800' },
  restBarTrack: {
    width: '100%',
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.cardRaised,
    overflow: 'hidden',
  },
  restBarFill: { height: 4, borderRadius: 2, backgroundColor: theme.accent },
  rowGap: { flexDirection: 'row', gap: 10, marginTop: 4 },
  ghostBtn: {
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.cardRaised,
  },
  ghostBtnText: { color: theme.text, fontSize: 15, fontWeight: '600' },
  solidBtn: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: theme.radius,
    backgroundColor: theme.accent,
  },
  solidBtnText: { color: theme.onAccent, fontSize: 15, fontWeight: '700' },
  upNext: { color: theme.textFaint, fontSize: 13, marginTop: 2 },
  list: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
  },
  rowCurrent: { borderColor: theme.textFaint },
  rowDone: { opacity: 0.85 },
  rowLabel: { color: theme.textDim, fontSize: 13, fontWeight: '600', flex: 1 },
  rowTarget: { color: theme.text, fontSize: 14, fontWeight: '600' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 4, width: 86, justifyContent: 'flex-end' },
  stepBtn: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: theme.cardRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { color: theme.text, fontSize: 14, fontWeight: '700' },
  actual: { color: theme.good, fontSize: 15, fontWeight: '700', minWidth: 22, textAlign: 'center' },
  endEarly: { alignItems: 'center', paddingVertical: 12 },
  endEarlyText: { color: theme.textFaint, fontSize: 13 },
});
