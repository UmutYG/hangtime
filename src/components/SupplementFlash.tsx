import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { absorptionNote, mechName } from '../engine/absorption';
import type { SupplementContext, SupplementDay, SupplementItem } from '../engine/types';
import { MECH_COLOR, theme } from '../theme';

const CHIPS: { key: SupplementContext; label: string }[] = [
  { key: 'empty', label: 'Empty stomach' },
  { key: 'food', label: 'With food' },
  { key: 'fat', label: 'With fat' },
];

/**
 * The moment after logging a dose: what is actually happening, given how it
 * actually went down.
 *
 * The chips are optional by design. A rushed log still gets an honest general
 * answer; saying how you took it rewrites the line for what really happened.
 * Nothing here grades the day — a dose that lands less fully is information,
 * not a mistake.
 */
export function SupplementFlash({
  item,
  at,
  day,
  items,
  onContext,
  onDone,
}: {
  item: SupplementItem;
  at: string;
  day: SupplementDay;
  items: SupplementItem[];
  onContext: (ctx: SupplementContext | null) => void;
  onDone: () => void;
}) {
  const [ctx, setCtx] = useState<SupplementContext | null>(day.ctx?.[item.id] ?? null);
  const enter = useRef(new Animated.Value(0)).current;
  const done = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const accent = MECH_COLOR[item.mech];
  const note = useMemo(
    () => absorptionNote(item, ctx, at, day, items),
    [item, ctx, at, day, items]
  );

  const dismiss = () => {
    if (done.current) return;
    done.current = true;
    Animated.timing(enter, {
      toValue: 0,
      duration: 200,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => onDone());
  };

  // Answering restarts the clock — you've just asked it something, so it
  // should stay long enough to read the new answer.
  const arm = (ms: number) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(dismiss, ms);
  };

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    arm(9000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const choose = (key: SupplementContext) => {
    const next = ctx === key ? null : key;
    setCtx(next);
    onContext(next);
    arm(11000);
  };

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        {
          opacity: enter,
          transform: [
            { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
          ],
        },
      ]}
    >
      <View style={styles.card}>
        <Pressable onPress={dismiss}>
          <View style={styles.head}>
            <Absorption landing={note.landing} accent={accent} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: accent }]} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.mech}>
                {mechName(item.mech)} · {at}
              </Text>
            </View>
          </View>
          <Text style={styles.body}>{note.body}</Text>
          {note.aside ? <Text style={styles.aside}>{note.aside}</Text> : null}
        </Pressable>

        <View style={styles.chips}>
          {CHIPS.map((c) => {
            const on = ctx === c.key;
            return (
              <Pressable
                key={c.key}
                onPress={() => choose(c.key)}
                style={[styles.chip, on && { backgroundColor: accent, borderColor: accent }]}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{c.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Animated.View>
  );
}

/**
 * A dose travelling in. Three dots cross the track and settle; how many settle
 * is how much of it lands. It reads at a glance and says the same thing the
 * words do, which is the point of having it at all.
 */
function Absorption({ landing, accent }: { landing: 'full' | 'partial' | 'little'; accent: string }) {
  const settle = [3, 2, 1][['full', 'partial', 'little'].indexOf(landing)];
  const dots = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const runs = dots.map((d, i) =>
      Animated.timing(d, {
        toValue: 1,
        duration: 900,
        delay: 120 + i * 260,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      })
    );
    Animated.parallel(runs).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.viz}>
      <View style={[styles.vizTrack, { backgroundColor: `${accent}33` }]} />
      {dots.map((d, i) => {
        const lands = i < settle;
        return (
          <Animated.View
            key={i}
            style={[
              styles.vizDot,
              {
                backgroundColor: accent,
                opacity: lands
                  ? d.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] })
                  : d.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.35, 0.2, 0] }),
                transform: [
                  {
                    translateX: d.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-11, lands ? 11 : 2],
                    }),
                  },
                  { translateY: i * 7 - 7 },
                ],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 14, right: 14, bottom: 100 },
  card: {
    backgroundColor: theme.dark,
    borderRadius: theme.radiusLg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.24,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  mech: { color: theme.onDark, opacity: 0.45, fontSize: 11, marginTop: 2 },
  body: { color: theme.onDark, opacity: 0.9, fontSize: 13.5, lineHeight: 19.5, marginTop: 2 },
  aside: { color: theme.onDark, opacity: 0.58, fontSize: 12.5, lineHeight: 18 },
  chips: { flexDirection: 'row', gap: 7, marginTop: 2 },
  chip: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipText: { color: theme.onDark, opacity: 0.72, fontSize: 11.5, fontWeight: '600' },
  chipTextOn: { color: '#FFFFFF', opacity: 1 },
  viz: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  vizTrack: { position: 'absolute', width: 30, height: 1.5, borderRadius: 1 },
  vizDot: { position: 'absolute', width: 6, height: 6, borderRadius: 3 },
});
