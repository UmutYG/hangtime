import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { nextStatus, statusOf, supDayFor } from '../engine/supplements';
import { absorptionNote, todayLine } from '../engine/absorption';
import type { SupplementContext, SupplementItem, SupplementStatus } from '../engine/types';
import { useStore } from '../hooks/useStore';
import { MECH_COLOR, mono, modeIdentity, theme, type } from '../theme';
import { RoofBar } from '../components/RoofBar';
import { ModeMark } from '../components/ModeMark';
import { Sheet } from '../components/Sheet';
import { SupplementFlash } from '../components/SupplementFlash';
import { syncSupplementReminders } from '../lib/supplementNotifications';

const CTX_LABEL: Record<SupplementContext, string> = {
  empty: 'empty stomach',
  food: 'with food',
  fat: 'with fat',
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
function todayLabel(): string {
  return new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

export function SupTodayScreen() {
  const { store, setSupplementStatus, setSupplementContext } = useStore();
  const [viewing, setViewing] = useState<SupplementItem | null>(null);
  const [flash, setFlash] = useState<SupplementItem | null>(null);

  // Entering this room is the one place it's fair to ask for notification
  // permission — the reminders belong to what's on this screen. Everywhere
  // else the schedule syncs silently, only if permission already exists.
  useEffect(() => {
    void syncSupplementReminders(store.supItems ?? [], store.supDays ?? [], { ask: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const items = (store.supItems ?? []).filter((i) => i.active).sort((a, b) => a.order - b.order);
  const day = supDayFor(store.supDays ?? [], todayIso());
  const takenCount = items.filter((i) => statusOf(day, i.id) === 'taken').length;
  const skippedCount = items.filter((i) => statusOf(day, i.id) === 'skipped').length;
  const answered = takenCount + skippedCount;
  const now = new Date();
  // the day as it actually went, not as a weekday routine assumes it went
  const nowLine = todayLine(items, day, now.getHours() + now.getMinutes() / 60);

  const viewingStatus = viewing ? statusOf(day, viewing.id) : null;
  const viewingStamp = viewing
    ? (day.taken[viewing.id] ?? day.skipped?.[viewing.id])
    : undefined;

  // Logging a dose is the one moment worth saying something: the flash shows
  // what it's doing in the body. Skipping and undoing pass quietly.
  const record = (item: SupplementItem, status: SupplementStatus | null) => {
    setSupplementStatus(item.id, status);
    if (status === 'taken') setFlash(item);
  };

  return (
    <View style={{ flex: 1 }}>
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
          <Text style={styles.nowLabel}>TODAY SO FAR</Text>
          <Text style={styles.nowState}>{nowLine.state}</Text>
          <Text style={styles.nowWhy}>{nowLine.why}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.listHeader}>
            <Text style={[type.kickerDim, { color: theme.supp }]}>TODAY</Text>
            <Text style={[styles.countText, mono]}>
              {takenCount} of {items.length} taken
              {skippedCount > 0 ? ` · ${skippedCount} skipped` : ''}
            </Text>
          </View>
          {items.map((it, idx) => {
            const status = statusOf(day, it.id);
            const stamp = day.taken[it.id] ?? day.skipped?.[it.id];
            const color = MECH_COLOR[it.mech];
            return (
              <View key={it.id} style={[styles.row, idx === items.length - 1 && styles.rowLast]}>
                <Pressable
                  onPress={() => record(it, nextStatus(status))}
                  hitSlop={8}
                  style={[
                    styles.tick,
                    { borderColor: status ? color : theme.borderStrong },
                    status === 'taken' ? { backgroundColor: color } : null,
                  ]}
                >
                  {status === 'taken' ? <Text style={styles.tickMark}>✓</Text> : null}
                  {status === 'skipped' ? (
                    <View style={[styles.skipBar, { backgroundColor: color }]} />
                  ) : null}
                </Pressable>
                <Pressable style={styles.rowBody} onPress={() => setViewing(it)}>
                  <Text style={[styles.rowName, status ? styles.rowNameDone : null]}>{it.name}</Text>
                  <View style={styles.rowMeta}>
                    {status === 'taken' ? (
                      <Text style={[styles.stamp, mono]}>{stamp}</Text>
                    ) : status === 'skipped' ? (
                      <Text style={styles.skippedText}>skipped today</Text>
                    ) : (
                      <Text style={styles.slot}>{it.slot}</Text>
                    )}
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

        {items.length > 0 && answered === items.length ? (
          <Text style={styles.doneNote}>Every one answered today.</Text>
        ) : (
          <Text style={styles.footNote}>
            Tap the circle once for taken, twice to mark it skipped. No streaks — logged days are
            context for reading your body, not a score to protect.
          </Text>
        )}
      </ScrollView>

      {flash ? (
        <SupplementFlash
          item={flash}
          at={day.taken[flash.id] ?? ''}
          day={day}
          items={items}
          onContext={(ctx: SupplementContext | null) => setSupplementContext(flash.id, ctx)}
          onDone={() => setFlash(null)}
        />
      ) : null}

      {viewing ? (
        <Sheet
          visible
          onClose={() => setViewing(null)}
          title={viewing.name}
          subtitle={viewing.slot}
        >
          {viewingStatus ? (
            <View style={[styles.doingCard, { borderLeftColor: MECH_COLOR[viewing.mech] }]}>
              <Text style={styles.doingText}>
                {viewingStatus === 'taken'
                  ? absorptionNote(viewing, day.ctx?.[viewing.id] ?? null, viewingStamp ?? '', day, items).body
                  : 'Skipped today — no judgement, it just means today has no dose to read.'}
              </Text>
              <Text style={[styles.doingStamp, mono]}>
                {viewingStatus === 'taken' ? 'logged' : 'skipped'} {viewingStamp}
                {viewingStatus === 'taken' && day.ctx?.[viewing.id]
                  ? ` · ${CTX_LABEL[day.ctx[viewing.id]]}`
                  : ''}
              </Text>
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

          {viewingStatus === null ? (
            <>
              <Pressable
                onPress={() => {
                  record(viewing, 'taken');
                  setViewing(null);
                }}
                style={styles.sheetBtn}
              >
                <Text style={styles.sheetBtnText}>Log it</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  record(viewing, 'skipped');
                  setViewing(null);
                }}
                style={[styles.sheetBtn, styles.sheetBtnGhost]}
              >
                <Text style={[styles.sheetBtnText, styles.sheetBtnGhostText]}>Skip today</Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              onPress={() => {
                record(viewing, null);
                setViewing(null);
              }}
              style={[styles.sheetBtn, styles.sheetBtnGhost]}
            >
              <Text style={[styles.sheetBtnText, styles.sheetBtnGhostText]}>
                Clear {viewingStatus === 'taken' ? 'this log' : 'the skip'}
              </Text>
            </Pressable>
          )}
        </Sheet>
      ) : null}
    </View>
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
  skipBar: { width: 11, height: 2, borderRadius: 1 },
  rowBody: { flex: 1, gap: 3 },
  rowName: { fontSize: 15, fontWeight: '600', color: theme.text },
  rowNameDone: { opacity: 0.45, textDecorationLine: 'line-through' },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  slot: { fontSize: 11.5, color: theme.textFaint },
  stamp: { fontSize: 11, color: theme.textFaint },
  skippedText: { fontSize: 11.5, color: theme.textFaint, fontStyle: 'italic' },
  chev: { color: theme.textFaint, fontSize: 17, opacity: 0.6 },
  emptyText: { color: theme.textFaint, fontSize: 13, paddingVertical: 12 },
  footNote: {
    color: theme.textFaint,
    fontSize: 11.5,
    lineHeight: 17,
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  doneNote: {
    color: theme.supp,
    fontSize: 12.5,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 10,
  },
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
    marginTop: 14,
    backgroundColor: theme.dark,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  sheetBtnText: { color: theme.onDark, fontSize: 14.5, fontWeight: '700' },
  sheetBtnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.borderStrong },
  sheetBtnGhostText: { color: theme.textDim },
});
