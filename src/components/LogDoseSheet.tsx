import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { absorptionNote, mechName } from '../engine/absorption';
import {
  SITE_LABEL,
  journeyFor,
  parseClock,
  positionAt,
  type BodySite,
} from '../engine/pharmacokinetics';
import type { SupplementContext, SupplementDay, SupplementItem } from '../engine/types';
import { MECH_COLOR, mono, theme } from '../theme';
import { BodyFigure } from './BodyFigure';

const CHIPS: { key: SupplementContext; label: string; hint: string }[] = [
  { key: 'empty', label: 'Empty stomach', hint: 'nothing eaten for a while' },
  { key: 'food', label: 'With food', hint: 'a meal or a snack' },
  { key: 'fat', label: 'With fat', hint: 'oil, eggs, nuts, dairy' },
];

function clampMin(n: number): number {
  return n < 0 ? n + 1440 : n > 1439 ? n - 1440 : n;
}
function fmtMin(mins: number): string {
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}

/**
 * The moment after logging a dose, in two beats.
 *
 * First it asks how the dose actually went down, because that is the one
 * thing the app cannot observe and the thing every downstream answer depends
 * on. Then it says what that means and shows where the dose is headed.
 *
 * Answering stays optional at every step — a rushed log still gets an honest
 * general answer. Nothing here grades the choice; a dose that lands slowly is
 * information, not a mistake.
 *
 * The timestamp is editable here too, not just when back-filling an older
 * day: "took it this morning, logging it at lunch" is the normal case, and a
 * log that can only ever say `now` quietly turns every late entry into a
 * wrong one — which then feeds the absorption and journey answers.
 */
export function LogDoseSheet({
  item,
  at,
  day,
  items,
  onContext,
  onTime,
  onDone,
  onSeeLive,
}: {
  item: SupplementItem;
  at: string;
  day: SupplementDay;
  items: SupplementItem[];
  onContext: (ctx: SupplementContext | null) => void;
  /** move the dose to another time on the same day */
  onTime?: (time: string) => void;
  onDone: () => void;
  onSeeLive?: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [ctx, setCtx] = useState<SupplementContext | null>(day.ctx?.[item.id] ?? null);
  const [editingTime, setEditingTime] = useState(false);
  const [mins, setMins] = useState<number>(() => parseClock(at) ?? 0);
  const fade = useRef(new Animated.Value(0)).current;

  // The sheet owns the clock while it's open, so every downstream answer
  // (absorption, journey position) reflects the corrected time immediately.
  const atNow = onTime ? fmtMin(mins) : at;
  const shiftTime = (delta: number) => {
    const next = clampMin(mins + delta);
    setMins(next);
    onTime?.(fmtMin(next));
  };

  const accent = MECH_COLOR[item.mech];
  const note = useMemo(
    () => absorptionNote(item, ctx, atNow, day, items),
    [item, ctx, atNow, day, items]
  );
  const phases = useMemo(() => journeyFor(item, ctx), [item, ctx]);

  // Where it is at the moment this sheet is open — usually phase one, but a
  // dose taken hours ago and only logged now starts much further along, which
  // is the whole reason the time is editable.
  const now = new Date();
  const pos = positionAt(item, ctx, atNow, now.getHours() * 60 + now.getMinutes());
  const current = pos?.phase ?? phases[0];

  const sites = useMemo(() => {
    const map: Partial<Record<BodySite, number>> = {};
    for (const p of phases) map[p.site] = Math.max(map[p.site] ?? 0, 0.22);
    map[current.site] = 1;
    return map;
  }, [phases, current]);

  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [fade]);

  const choose = (key: SupplementContext) => setCtx(ctx === key ? null : key);

  const next = () => {
    onContext(ctx); // record it (or clear it) exactly as answered
    setStep(2);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDone}>
      <Pressable style={styles.backdrop} onPress={onDone}>
        <Animated.View
          style={{
            opacity: fade,
            transform: [
              { translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
            ],
            width: '100%',
          }}
        >
          <Pressable style={styles.card} onPress={() => {}}>
            <View style={styles.head}>
              <Text style={[styles.name, { color: accent }]} numberOfLines={1}>
                {item.name}
              </Text>
              {onTime && step === 1 ? (
                <Pressable
                  onPress={() => setEditingTime((v) => !v)}
                  hitSlop={8}
                  accessibilityLabel="Change the time"
                >
                  <Text style={[styles.stamp, mono]}>
                    {mechName(item.mech)} ·{' '}
                    <Text style={{ color: accent }}>
                      {atNow} {editingTime ? '▾' : '✎'}
                    </Text>
                  </Text>
                </Pressable>
              ) : (
                <Text style={[styles.stamp, mono]}>
                  {mechName(item.mech)} · {atNow}
                </Text>
              )}
            </View>

            {/* Only unfolds when asked — the common case is logging as you
                take it, and that path shouldn't grow a control it never needs. */}
            {onTime && step === 1 && editingTime ? (
              <View style={styles.timeRow}>
                <TimeStep label="hour" onUp={() => shiftTime(60)} onDown={() => shiftTime(-60)} />
                <Text style={[styles.timeBig, mono]}>{atNow}</Text>
                <TimeStep label="min" onUp={() => shiftTime(5)} onDown={() => shiftTime(-5)} />
              </View>
            ) : null}

            {step === 1 ? (
              <>
                <Text style={styles.question}>How did you take it?</Text>
                <View style={styles.chips}>
                  {CHIPS.map((c) => {
                    const on = ctx === c.key;
                    return (
                      <Pressable
                        key={c.key}
                        onPress={() => choose(c.key)}
                        style={[
                          styles.chip,
                          on && { backgroundColor: accent, borderColor: accent },
                        ]}
                      >
                        <Text style={[styles.chipText, on && styles.chipTextOn]}>{c.label}</Text>
                        <Text style={[styles.chipHint, on && styles.chipHintOn]}>{c.hint}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Pressable style={[styles.primary, { backgroundColor: accent }]} onPress={next}>
                  <Text style={styles.primaryText}>Next</Text>
                </Pressable>
                {/* Answering is optional — the reassurance only needs to be
                    there while the question is still unanswered. */}
                {ctx === null ? (
                  <Pressable onPress={next} hitSlop={8}>
                    <Text style={styles.skip}>Don't remember — skip</Text>
                  </Pressable>
                ) : (
                  <Text style={styles.skip}>Tap it again to unpick</Text>
                )}
              </>
            ) : (
              <>
                <View style={styles.stage}>
                  <BodyFigure
                    active={sites}
                    accent={accent}
                    size={132}
                    animate
                  />
                  <View style={styles.stageText}>
                    <Text style={[styles.phaseLabel, { color: accent }]}>{current.label}</Text>
                    <Text style={styles.siteLabel}>{SITE_LABEL[current.site]}</Text>
                    <Text style={styles.phaseBody}>{current.body}</Text>
                  </View>
                </View>

                <Text style={styles.note}>{note.body}</Text>
                {note.aside ? <Text style={styles.aside}>{note.aside}</Text> : null}

                {onSeeLive ? (
                  <Pressable
                    style={[styles.primary, { backgroundColor: accent }]}
                    onPress={() => {
                      onDone();
                      onSeeLive();
                    }}
                  >
                    <Text style={styles.primaryText}>See it live in your body</Text>
                  </Pressable>
                ) : null}
                <Pressable onPress={onDone} hitSlop={8}>
                  <Text style={styles.skip}>Done</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

function TimeStep({
  label,
  onUp,
  onDown,
}: {
  label: string;
  onUp: () => void;
  onDown: () => void;
}) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Pressable onPress={onUp} hitSlop={10} style={styles.timeBtn} accessibilityLabel={`${label} up`}>
        <Text style={styles.timeArrow}>▲</Text>
      </Pressable>
      <Text style={styles.timeLabel}>{label}</Text>
      <Pressable
        onPress={onDown}
        hitSlop={10}
        style={styles.timeBtn}
        accessibilityLabel={`${label} down`}
      >
        <Text style={styles.timeArrow}>▼</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 4,
  },
  timeBig: { color: theme.onDark, fontSize: 30, fontWeight: '300', letterSpacing: 1 },
  timeBtn: { paddingVertical: 3, paddingHorizontal: 8 },
  timeArrow: { color: theme.onDark, opacity: 0.7, fontSize: 13 },
  timeLabel: {
    color: theme.onDark,
    opacity: 0.35,
    fontSize: 8.5,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20,19,17,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  card: {
    backgroundColor: theme.dark,
    borderRadius: theme.radiusSheet,
    padding: 20,
    gap: 12,
  },
  head: { gap: 3 },
  name: { fontSize: 12, fontWeight: '700', letterSpacing: 0.9, textTransform: 'uppercase' },
  stamp: { color: theme.onDark, opacity: 0.45, fontSize: 11 },
  question: { color: theme.onDark, fontSize: 17, fontWeight: '600', marginTop: 2 },
  chips: { gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 2,
  },
  chipText: { color: theme.onDark, opacity: 0.85, fontSize: 14.5, fontWeight: '600' },
  chipTextOn: { color: '#FFFFFF', opacity: 1 },
  chipHint: { color: theme.onDark, opacity: 0.42, fontSize: 11.5 },
  chipHintOn: { color: '#FFFFFF', opacity: 0.75 },
  primary: {
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryText: { color: '#FFFFFF', fontSize: 14.5, fontWeight: '700' },
  skip: {
    color: theme.onDark,
    opacity: 0.5,
    fontSize: 12.5,
    textAlign: 'center',
    paddingVertical: 6,
  },
  stage: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stageText: { flex: 1, gap: 3 },
  phaseLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  siteLabel: { color: theme.onDark, fontSize: 15, fontWeight: '600' },
  phaseBody: { color: theme.onDark, opacity: 0.65, fontSize: 12.5, lineHeight: 18 },
  note: { color: theme.onDark, opacity: 0.9, fontSize: 13.5, lineHeight: 19.5 },
  aside: { color: theme.onDark, opacity: 0.55, fontSize: 12.5, lineHeight: 18 },
});
