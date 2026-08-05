import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { parseClock } from '../engine/pharmacokinetics';
import type { SupplementContext, SupplementItem } from '../engine/types';
import { MECH_COLOR, mono, theme } from '../theme';

const CHIPS: { key: SupplementContext; label: string }[] = [
  { key: 'empty', label: 'Empty stomach' },
  { key: 'food', label: 'With food' },
  { key: 'fat', label: 'With fat' },
];

function clamp(n: number, lo: number, hi: number): number {
  return n < lo ? hi : n > hi ? lo : n;
}

function fmt(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Filling in a dose on a day that has already gone by.
 *
 * The time starts at the item's usual slot but is never written without being
 * confirmed — the whole room refuses to assert a routine from the clock, and
 * a back-filled dose is exactly where that would be easiest to get wrong.
 */
export function BackfillDoseSheet({
  item,
  dateLabel,
  initialTime,
  onCancel,
  onSave,
}: {
  item: SupplementItem;
  dateLabel: string;
  initialTime: string;
  onCancel: () => void;
  onSave: (time: string, ctx: SupplementContext | null) => void;
}) {
  const [mins, setMins] = useState<number>(parseClock(initialTime) ?? 720);
  const [ctx, setCtx] = useState<SupplementContext | null>(null);
  const accent = MECH_COLOR[item.mech];

  const bump = (delta: number) => setMins((m) => clamp(m + delta, 0, 1439));

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={{ gap: 3 }}>
            <Text style={[styles.name, { color: accent }]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.sub}>{dateLabel}</Text>
          </View>

          <Text style={styles.question}>What time did you take it?</Text>

          <View style={styles.clockRow}>
            <Stepper label="hour" onUp={() => bump(60)} onDown={() => bump(-60)} />
            <Text style={[styles.clock, mono]}>{fmt(mins)}</Text>
            <Stepper label="minute" onUp={() => bump(5)} onDown={() => bump(-5)} />
          </View>
          <Text style={styles.guessNote}>
            Starts at when you usually take it — change it to whatever actually happened.
          </Text>

          <View style={styles.chips}>
            {CHIPS.map((c) => {
              const on = ctx === c.key;
              return (
                <Pressable
                  key={c.key}
                  onPress={() => setCtx(on ? null : c.key)}
                  style={[styles.chip, on && { backgroundColor: accent, borderColor: accent }]}
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{c.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            style={[styles.primary, { backgroundColor: accent }]}
            onPress={() => onSave(fmt(mins), ctx)}
          >
            <Text style={styles.primaryText}>Log it</Text>
          </Pressable>
          <Pressable onPress={onCancel} hitSlop={8}>
            <Text style={styles.skip}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Stepper({
  label,
  onUp,
  onDown,
}: {
  label: string;
  onUp: () => void;
  onDown: () => void;
}) {
  return (
    <View style={styles.stepper}>
      <Pressable onPress={onUp} hitSlop={10} style={styles.stepBtn} accessibilityLabel={`${label} up`}>
        <Text style={styles.stepText}>▲</Text>
      </Pressable>
      <Text style={styles.stepLabel}>{label}</Text>
      <Pressable
        onPress={onDown}
        hitSlop={10}
        style={styles.stepBtn}
        accessibilityLabel={`${label} down`}
      >
        <Text style={styles.stepText}>▼</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20,19,17,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  card: { backgroundColor: theme.dark, borderRadius: theme.radiusSheet, padding: 20, gap: 12 },
  name: { fontSize: 12, fontWeight: '700', letterSpacing: 0.9, textTransform: 'uppercase' },
  sub: { color: theme.onDark, opacity: 0.45, fontSize: 11.5 },
  question: { color: theme.onDark, fontSize: 17, fontWeight: '600', marginTop: 2 },
  clockRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18 },
  clock: { color: theme.onDark, fontSize: 40, fontWeight: '300', letterSpacing: 1 },
  stepper: { alignItems: 'center', gap: 2 },
  stepBtn: { paddingVertical: 4, paddingHorizontal: 10 },
  stepText: { color: theme.onDark, opacity: 0.7, fontSize: 15 },
  stepLabel: {
    color: theme.onDark,
    opacity: 0.35,
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  guessNote: {
    color: theme.onDark,
    opacity: 0.42,
    fontSize: 11.5,
    lineHeight: 16.5,
    textAlign: 'center',
  },
  chips: { flexDirection: 'row', gap: 7, justifyContent: 'center', flexWrap: 'wrap' },
  chip: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipText: { color: theme.onDark, opacity: 0.75, fontSize: 12, fontWeight: '600' },
  chipTextOn: { color: '#FFFFFF', opacity: 1 },
  primary: { borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 2 },
  primaryText: { color: '#FFFFFF', fontSize: 14.5, fontWeight: '700' },
  skip: { color: theme.onDark, opacity: 0.5, fontSize: 12.5, textAlign: 'center', paddingVertical: 4 },
});
