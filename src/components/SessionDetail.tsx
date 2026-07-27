import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LoggedSession } from '../engine/types';
import { PUSH_VARIATIONS } from '../engine/pushups';
import { DAY_TITLE } from '../lib/dayLabels';
import { theme, mono } from '../theme';
import { Sheet } from './Sheet';

// Read-only session breakdown — every data point the log carries, including
// the rest you actually took vs what was planned. Edit/Delete live here too.

const READINESS_LABEL: Record<string, string> = { good: 'Felt good', ok: 'Felt OK', rough: 'Rough day' };
const EFFORT_LABEL: Record<string, string> = { easy: 'Last set easy', right: 'Last set right', grind: 'Last set a grind' };

function fmtDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

function variationName(key?: string): string | null {
  if (!key || key === 'standard') return null;
  return PUSH_VARIATIONS.find((v) => v.key === key)?.name ?? null;
}

export function SessionDetail({
  session,
  accent = theme.accent,
  onClose,
  onEdit,
  onDelete,
}: {
  session: LoggedSession | null;
  accent?: string;
  onClose: () => void;
  onEdit: (s: LoggedSession) => void;
  onDelete: (id: string) => void;
}) {
  if (!session) return null;

  const working = session.sets.filter((s) => !s.isWarmup);
  const totalReps = session.sets.reduce((sum, s) => sum + s.actualReps, 0);
  const totalTarget = working.reduce((sum, s) => sum + s.targetReps, 0);
  const totalActual = working.reduce((sum, s) => sum + s.actualReps, 0);
  const completion = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : null;

  const restPairs = working.filter((s) => s.restSecTaken !== undefined && (s.restSecPlanned ?? 0) > 0);
  const avgTaken =
    restPairs.length > 0
      ? Math.round(restPairs.reduce((a, s) => a + (s.restSecTaken ?? 0), 0) / restPairs.length)
      : null;
  const avgPlanned =
    restPairs.length > 0
      ? Math.round(restPairs.reduce((a, s) => a + (s.restSecPlanned ?? 0), 0) / restPairs.length)
      : null;

  const topLoad = Math.max(0, ...working.map((s) => s.loadKg));

  let workingNo = 0;

  return (
    <Sheet visible onClose={onClose} title={DAY_TITLE[session.dayKind] ?? session.dayKind} subtitle={fmtDate(session.date)}>
      {session.readiness || session.lastSetEffort ? (
        <View style={styles.chipRow}>
          {session.readiness ? (
            <View style={styles.chip}>
              <Text style={styles.chipText}>{READINESS_LABEL[session.readiness]}</Text>
            </View>
          ) : null}
          {session.lastSetEffort ? (
            <View style={styles.chip}>
              <Text style={styles.chipText}>{EFFORT_LABEL[session.lastSetEffort]}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.summaryCard}>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryValue, mono]}>{totalReps}</Text>
          <Text style={styles.summaryLabel}>total reps</Text>
        </View>
        {completion !== null ? (
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, mono, completion < 85 && { color: theme.warn }]}>
              {completion}%
            </Text>
            <Text style={styles.summaryLabel}>of target</Text>
          </View>
        ) : null}
        {avgTaken !== null ? (
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, mono]}>{avgTaken}s</Text>
            <Text style={styles.summaryLabel}>avg rest · plan {avgPlanned}s</Text>
          </View>
        ) : topLoad > 0 ? (
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, mono]}>+{topLoad}</Text>
            <Text style={styles.summaryLabel}>kg</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.setsCard}>
        {session.sets.map((s, i) => {
          if (!s.isWarmup) workingNo += 1;
          const vName = variationName(s.variationKey);
          const short = s.actualReps < s.targetReps;
          return (
            <View key={i} style={[styles.setRow, i === session.sets.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.setLabel}>
                  {s.isWarmup ? 'Warm-up' : `Set ${workingNo}`}
                  {vName ? <Text style={{ color: accent }}> · {vName}</Text> : null}
                  {s.loadKg > 0 ? <Text style={styles.setLoad}> · +{s.loadKg} kg</Text> : null}
                </Text>
                {s.restSecTaken !== undefined ? (
                  <Text style={styles.restLine}>
                    {s.restSecTaken}s rest{(s.restSecPlanned ?? 0) > 0 ? ` · plan ${s.restSecPlanned}s` : ''}
                  </Text>
                ) : (s.restSecPlanned ?? 0) > 0 ? (
                  <Text style={styles.restLine}>plan {s.restSecPlanned}s rest</Text>
                ) : null}
              </View>
              <Text style={[styles.setReps, mono, short && { color: theme.warn }]}>
                {s.actualReps}
                <Text style={styles.setTarget}>/{s.targetReps}</Text>
              </Text>
            </View>
          );
        })}
      </View>

      <View style={styles.btnRow}>
        <Pressable onPress={() => onEdit(session)} style={styles.editBtn}>
          <Text style={styles.editText}>Edit session</Text>
        </Pressable>
        <Pressable onPress={() => onDelete(session.id)} style={styles.deleteBtn} hitSlop={6}>
          <Text style={styles.deleteText}>Delete</Text>
        </Pressable>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  chip: {
    backgroundColor: theme.cardMuted,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: { color: theme.textDim, fontSize: 12, fontWeight: '600' },
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: theme.card,
    borderRadius: theme.radiusLg,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 14,
    marginBottom: 12,
  },
  summaryItem: { flex: 1, alignItems: 'center', gap: 2 },
  summaryValue: { fontSize: 19, fontWeight: '700', color: theme.text },
  summaryLabel: { fontSize: 10.5, color: theme.textFaint, textAlign: 'center' },
  setsCard: {
    backgroundColor: theme.card,
    borderRadius: theme.radiusLg,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: theme.cardMuted,
    gap: 10,
  },
  setLabel: { fontSize: 13.5, fontWeight: '600', color: theme.text },
  setLoad: { color: theme.textDim, fontWeight: '500' },
  restLine: { fontSize: 11.5, color: theme.textFaint, marginTop: 2 },
  setReps: { fontSize: 15, fontWeight: '600', color: theme.text },
  setTarget: { fontSize: 11, color: theme.textFaint },
  btnRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  editBtn: {
    flex: 1,
    backgroundColor: theme.cardMuted,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  editText: { color: theme.text, fontSize: 14.5, fontWeight: '600' },
  deleteBtn: { paddingHorizontal: 12, paddingVertical: 12 },
  deleteText: { color: theme.danger, fontSize: 13.5 },
});
