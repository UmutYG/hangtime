import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  WEEKDAY_LABELS,
  monthGrid,
  monthLabel,
  shiftMonth,
  weekdayTally,
} from '../engine/calendar';
import type { ISODate } from '../engine/types';
import { useStore } from '../hooks/useStore';
import { AppMode, mono, theme } from '../theme';
import { ModeMark } from './ModeMark';

// The same marks the spaces use elsewhere — a day reads as "pull-ups and
// push-ups" rather than "orange and purple", with nothing to decode.
const SPACES: { key: string; mode: AppMode; label: string; color: string }[] = [
  { key: 'pull', mode: 'pullups', label: 'Pull', color: theme.accent },
  { key: 'push', mode: 'pushups', label: 'Push', color: theme.push },
  { key: 'run', mode: 'running', label: 'Run', color: theme.run },
];

function todayIso(): ISODate {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Every training day, on a calendar.
 *
 * Deliberately all three spaces at once even though History is per-space: the
 * question this answers is "when do I actually train", and the shape of that —
 * the gaps, the weekdays that never fill in — only appears when pull, push and
 * run are on the same grid. Weeks start Monday so the columns line up with the
 * days the programme talks about.
 */
export function TrainingCalendar({ onClose }: { onClose: () => void }) {
  const { store } = useStore();
  const today = todayIso();
  const now = new Date();
  const [{ year, month }, setMonth] = useState({
    year: now.getFullYear(),
    month: now.getMonth(),
  });

  // date → which spaces were trained that day
  const byDate = useMemo(() => {
    const map = new Map<string, Set<string>>();
    const add = (date: string, key: string) => {
      const s = map.get(date) ?? new Set<string>();
      s.add(key);
      map.set(date, s);
    };
    for (const s of store.sessions) if (s.dayKind !== 'custom') add(s.date, 'pull');
    for (const s of store.pushSessions) if (s.dayKind !== 'pushCustom') add(s.date, 'push');
    for (const r of store.runs) add(r.date, 'run');
    return map;
  }, [store.sessions, store.pushSessions, store.runs]);

  const weeks = useMemo(() => monthGrid(year, month), [year, month]);

  const monthDates = useMemo(
    () => weeks.flat().filter((d): d is ISODate => d !== null && byDate.has(d)),
    [weeks, byDate]
  );
  const tally = useMemo(() => weekdayTally(monthDates), [monthDates]);
  const maxTally = Math.max(1, ...tally);

  const go = (delta: number) => setMonth((m) => shiftMonth(m.year, m.month, delta));

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.nav}>
            <Pressable onPress={() => go(-1)} hitSlop={12} style={styles.navBtn}>
              <Text style={styles.navArrow}>‹</Text>
            </Pressable>
            <Text style={styles.month}>{monthLabel(year, month)}</Text>
            <Pressable onPress={() => go(1)} hitSlop={12} style={styles.navBtn}>
              <Text style={styles.navArrow}>›</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            <View style={styles.row}>
              {WEEKDAY_LABELS.map((d, i) => (
                <Text key={i} style={styles.weekdayHead}>
                  {d}
                </Text>
              ))}
            </View>

            {weeks.map((week, wi) => (
              <View key={wi} style={styles.row}>
                {week.map((date, di) => {
                  if (!date) return <View key={di} style={styles.cell} />;
                  const trained = byDate.get(date);
                  const isToday = date === today;
                  return (
                    <View key={di} style={styles.cell}>
                      <View style={[styles.dayBox, isToday && styles.dayBoxToday]}>
                        <Text
                          style={[
                            styles.dayNum,
                            mono,
                            trained ? styles.dayNumOn : null,
                            isToday && styles.dayNumToday,
                          ]}
                        >
                          {Number(date.slice(8))}
                        </Text>
                        <View style={styles.marks}>
                          {SPACES.filter((s) => trained?.has(s.key)).map((s) => (
                            <ModeMark key={s.key} mode={s.mode} size={13} color={s.color} />
                          ))}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            ))}

            {/* How the month actually fell across the week — the column that
                stays empty is the thing worth seeing. */}
            <View style={[styles.row, styles.tallyRow]}>
              {tally.map((n, i) => (
                <View key={i} style={styles.cell}>
                  <View style={styles.tallyTrack}>
                    <View
                      style={[
                        styles.tallyFill,
                        { height: `${(n / maxTally) * 100}%`, opacity: n ? 1 : 0 },
                      ]}
                    />
                  </View>
                  <Text style={[styles.tallyNum, mono]}>{n || ''}</Text>
                </View>
              ))}
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <View style={styles.legend}>
              {SPACES.map((s) => (
                <View key={s.key} style={styles.legendItem}>
                  <ModeMark mode={s.mode} size={13} color={s.color} />
                  <Text style={styles.legendText}>{s.label}</Text>
                </View>
              ))}
              <Text style={[styles.legendCount, mono]}>{monthDates.length} days</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={styles.close}>Close</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(20,19,17,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: theme.bg,
    borderTopLeftRadius: theme.radiusSheet,
    borderTopRightRadius: theme.radiusSheet,
    maxHeight: '88%',
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 16,
  },
  navBtn: { paddingHorizontal: 14, paddingVertical: 6 },
  navArrow: { fontSize: 24, color: theme.textDim, lineHeight: 28 },
  month: { fontSize: 19, fontWeight: '700', color: theme.text },
  body: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 4 },
  row: { flexDirection: 'row' },
  cell: { flex: 1, alignItems: 'center' },
  weekdayHead: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: theme.textFaint,
    paddingBottom: 6,
  },
  dayBox: {
    width: 46,
    height: 46,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    marginVertical: 2,
  },
  dayBoxToday: { borderWidth: 1.5, borderColor: theme.borderStrong },
  dayNum: { fontSize: 12.5, color: theme.textFaint },
  dayNumOn: { color: theme.text, fontWeight: '700' },
  dayNumToday: { color: theme.text },
  marks: { flexDirection: 'row', gap: 2, height: 14, alignItems: 'center' },
  tallyRow: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    alignItems: 'flex-end',
  },
  tallyTrack: { width: 20, height: 26, justifyContent: 'flex-end' },
  tallyFill: { width: '100%', borderRadius: 3, backgroundColor: theme.borderStrong },
  tallyNum: { fontSize: 10, color: theme.textFaint, marginTop: 3, height: 13 },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    gap: 10,
  },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendText: { fontSize: 12, color: theme.textDim },
  legendCount: { fontSize: 12, color: theme.textFaint, marginLeft: 'auto' },
  close: { textAlign: 'center', color: theme.textFaint, fontSize: 13, paddingVertical: 4 },
});
