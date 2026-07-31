import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MECH_INFO, nowWindow, supDayFor } from '../engine/supplements';
import type { SupplementItem } from '../engine/types';
import { useStore } from '../hooks/useStore';
import { MECH_COLOR, mono, modeIdentity, theme, type } from '../theme';
import { RoofBar } from '../components/RoofBar';
import { ModeMark } from '../components/ModeMark';
import { Sheet } from '../components/Sheet';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
function todayLabel(): string {
  return new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

export function SupTodayScreen() {
  const { store, toggleSupplement } = useStore();
  const [viewing, setViewing] = useState<SupplementItem | null>(null);

  const items = (store.supItems ?? []).filter((i) => i.active).sort((a, b) => a.order - b.order);
  const day = supDayFor(store.supDays ?? [], todayIso());
  const takenCount = items.filter((i) => day.taken[i.id]).length;
  const now = new Date();
  const nowLine = nowWindow(now.getHours() + now.getMinutes() / 60);

  const viewingStamp = viewing ? day.taken[viewing.id] : undefined;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <RoofBar />
      <View>
        <Text style={styles.dateLabel}>{todayLabel()}</Text>
        <Text style={type.hero}>Today</Text>
      </View>
      <View style={styles.mottoRow}>
        <ModeMark mode="supplements" size={15} color={theme.supp} />
        <Text style={styles.mottoText}>{modeIdentity('supplements').motto}</Text>
      </View>

      <View style={styles.nowCard}>
        <Text style={styles.nowLabel}>RIGHT NOW</Text>
        <Text style={styles.nowState}>{nowLine.state}</Text>
        <Text style={styles.nowWhy}>{nowLine.why}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.listHeader}>
          <Text style={[type.kickerDim, { color: theme.supp }]}>TODAY</Text>
          <Text style={[styles.countText, mono]}>
            {takenCount} of {items.length} logged
          </Text>
        </View>
        {items.map((it, idx) => {
          const stamp = day.taken[it.id];
          const color = MECH_COLOR[it.mech];
          return (
            <View key={it.id} style={[styles.row, idx === items.length - 1 && styles.rowLast]}>
              <Pressable
                onPress={() => toggleSupplement(it.id)}
                hitSlop={8}
                style={[
                  styles.tick,
                  { borderColor: stamp ? color : theme.borderStrong },
                  stamp ? { backgroundColor: color } : null,
                ]}
              >
                {stamp ? <Text style={styles.tickMark}>✓</Text> : null}
              </Pressable>
              <Pressable style={styles.rowBody} onPress={() => setViewing(it)}>
                <Text style={[styles.rowName, stamp ? styles.rowNameDone : null]}>{it.name}</Text>
                <View style={styles.rowMeta}>
                  {stamp ? (
                    <Text style={[styles.stamp, mono]}>{stamp}</Text>
                  ) : (
                    <Text style={styles.slot}>{it.slot}</Text>
                  )}
                  <View style={[styles.tag, { backgroundColor: `${color}22` }]}>
                    <Text style={[styles.tagText, { color }]}>{MECH_INFO[it.mech].tag}</Text>
                  </View>
                </View>
              </Pressable>
              <Text style={styles.chev}>›</Text>
            </View>
          );
        })}
        {items.length === 0 ? (
          <Text style={styles.emptyText}>
            Nothing in the stack. Add what you take under the Stack tab.
          </Text>
        ) : null}
      </View>

      <Text style={styles.footNote}>
        No streaks by design. Logged days are context for reading your body, not a score to protect.
      </Text>

      {viewing ? (
        <Sheet
          visible
          onClose={() => setViewing(null)}
          title={viewing.name}
          subtitle={viewing.slot}
        >
          <View style={styles.sheetTagRow}>
            <View style={[styles.tag, { backgroundColor: `${MECH_COLOR[viewing.mech]}22` }]}>
              <Text style={[styles.tagText, { color: MECH_COLOR[viewing.mech] }]}>
                {MECH_INFO[viewing.mech].tag}
              </Text>
            </View>
          </View>
          {viewingStamp && viewing.doing ? (
            <View style={[styles.doingCard, { borderLeftColor: MECH_COLOR[viewing.mech] }]}>
              <Text style={styles.doingText}>{viewing.doing}</Text>
              <Text style={[styles.doingStamp, mono]}>logged {viewingStamp}</Text>
            </View>
          ) : null}
          {viewing.why ? (
            <>
              <Text style={styles.sheetKicker}>WHY HERE</Text>
              <Text style={styles.sheetBody}>{viewing.why}</Text>
            </>
          ) : null}
          {viewing.notice ? (
            <>
              <Text style={styles.sheetKicker}>WHAT TO NOTICE</Text>
              <Text style={styles.sheetBody}>{viewing.notice}</Text>
            </>
          ) : null}
          <Pressable
            onPress={() => {
              toggleSupplement(viewing.id);
              setViewing(null);
            }}
            style={[styles.sheetBtn, viewingStamp ? styles.sheetBtnUndo : null]}
          >
            <Text style={[styles.sheetBtnText, viewingStamp ? styles.sheetBtnUndoText : null]}>
              {viewingStamp ? 'Undo this log' : 'Log it'}
            </Text>
          </Pressable>
        </Sheet>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: theme.pad, gap: 12, paddingBottom: 120 },
  dateLabel: { color: theme.textFaint, fontSize: 13, fontWeight: '500' },
  mottoRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: -6 },
  mottoText: { color: theme.textFaint, fontSize: 12.5, fontWeight: '500', letterSpacing: 0.1 },
  nowCard: {
    backgroundColor: theme.dark,
    borderRadius: theme.radiusLg,
    padding: 16,
    gap: 4,
  },
  nowLabel: { color: theme.onDark, opacity: 0.5, fontSize: 10, fontWeight: '700', letterSpacing: 1.4 },
  nowState: { color: theme.onDark, fontSize: 16, fontWeight: '600', lineHeight: 21 },
  nowWhy: { color: theme.onDark, opacity: 0.65, fontSize: 13, lineHeight: 18.5 },
  card: {
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: theme.radiusLg,
    padding: 16,
    paddingBottom: 6,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  countText: { fontSize: 12, color: theme.textFaint },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  rowLast: { borderBottomWidth: 0 },
  tick: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickMark: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  rowBody: { flex: 1, gap: 3 },
  rowName: { fontSize: 15, fontWeight: '600', color: theme.text },
  rowNameDone: { opacity: 0.45, textDecorationLine: 'line-through' },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  slot: { fontSize: 11.5, color: theme.textFaint },
  stamp: { fontSize: 11, color: theme.textFaint },
  tag: { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1.5 },
  tagText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  chev: { color: theme.textFaint, fontSize: 17, opacity: 0.6 },
  emptyText: { color: theme.textFaint, fontSize: 13, paddingVertical: 12 },
  footNote: {
    color: theme.textFaint,
    fontSize: 11.5,
    lineHeight: 17,
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  sheetTagRow: { flexDirection: 'row', marginTop: 6 },
  doingCard: {
    backgroundColor: theme.cardMuted,
    borderLeftWidth: 2.5,
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    gap: 6,
  },
  doingText: { fontSize: 13.5, lineHeight: 20, color: theme.textDim },
  doingStamp: { fontSize: 10.5, color: theme.textFaint, letterSpacing: 0.4, textTransform: 'uppercase' },
  sheetKicker: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: theme.textFaint,
    marginTop: 16,
    marginBottom: 4,
  },
  sheetBody: { fontSize: 14, lineHeight: 21, color: theme.text },
  sheetBtn: {
    marginTop: 22,
    backgroundColor: theme.dark,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  sheetBtnText: { color: theme.onDark, fontSize: 14.5, fontWeight: '700' },
  sheetBtnUndo: { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.borderStrong },
  sheetBtnUndoText: { color: theme.textDim },
});
