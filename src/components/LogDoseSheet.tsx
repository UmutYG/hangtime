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
 */
export function LogDoseSheet({
  item,
  at,
  day,
  items,
  onContext,
  onDone,
  onSeeLive,
}: {
  item: SupplementItem;
  at: string;
  day: SupplementDay;
  items: SupplementItem[];
  onContext: (ctx: SupplementContext | null) => void;
  onDone: () => void;
  onSeeLive?: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [ctx, setCtx] = useState<SupplementContext | null>(day.ctx?.[item.id] ?? null);
  const fade = useRef(new Animated.Value(0)).current;

  const accent = MECH_COLOR[item.mech];
  const note = useMemo(
    () => absorptionNote(item, ctx, at, day, items),
    [item, ctx, at, day, items]
  );
  const phases = useMemo(() => journeyFor(item, ctx), [item, ctx]);

  // Where it is at the moment this sheet is open — usually phase one, but a
  // dose logged a while after it was swallowed starts further along.
  const now = new Date();
  const pos = positionAt(item, ctx, at, now.getHours() * 60 + now.getMinutes());
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
              <Text style={[styles.stamp, mono]}>
                {mechName(item.mech)} · {at}
              </Text>
            </View>

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

const styles = StyleSheet.create({
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
