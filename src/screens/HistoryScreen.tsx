import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LoggedSession } from '../engine/types';
import { fmtDuration, fmtPace, paceSecPerKm, Run } from '../engine/runs';
import { useStore } from '../hooks/useStore';
import { theme, mono, type } from '../theme';
import { ManualLog } from '../components/ManualLog';
import { RunLog } from '../components/RunLog';
import { Sheet } from '../components/Sheet';

const DAY_LABEL: Record<string, string> = {
  calibration: 'CALIBRATION',
  heavy: 'WEIGHTED',
  volume: 'BODYWEIGHT · VOLUME',
  max: 'BODYWEIGHT · MAX',
  ladder: 'BODYWEIGHT · DENSITY',
  deloadHeavy: 'DELOAD',
  deloadVolume: 'DELOAD',
  testBw: 'TEST · PR',
  testWeighted: 'TEST · PR',
  custom: 'MANUAL',
};
const DAY_TITLE: Record<string, string> = {
  calibration: 'Calibration',
  heavy: 'Weighted pull-ups',
  volume: 'K Boges volume',
  max: 'Max-effort sets',
  ladder: 'Ladders',
  deloadHeavy: 'Deload',
  deloadVolume: 'Deload volume',
  testBw: 'BW max test',
  testWeighted: 'Vest max test',
  custom: 'Logged workout',
};
const KIND_COLOR: Record<string, string> = {
  heavy: theme.accent,
  testBw: theme.good,
  testWeighted: theme.good,
  deloadHeavy: theme.textFaint,
  deloadVolume: theme.textFaint,
};
const RUN_COLOR = theme.run;

function detailFor(s: LoggedSession): string {
  const working = s.sets.filter((x) => !x.isWarmup);
  const load = Math.max(0, ...working.map((x) => x.loadKg));
  if (working.length === 0) return '';
  const reps = working.map((x) => x.actualReps).join('-');
  return load > 0 ? `${working.length}× @ +${load} kg` : `${reps.length > 12 ? working.length + '× BW' : reps + ' BW'}`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

type HistoryItem =
  | { kind: 'session'; date: string; session: LoggedSession }
  | { kind: 'run'; date: string; run: Run };

export function HistoryScreen() {
  const { store, editSession, deleteSession, restoreSession, emptyTrash, editRun, addRun, deleteRun } =
    useStore();
  const [editing, setEditing] = useState<LoggedSession | null>(null);
  const [editingRun, setEditingRun] = useState<Run | null>(null);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [runLogOpen, setRunLogOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);

  const profile = store.profile!;

  const items = useMemo((): HistoryItem[] => {
    const list: HistoryItem[] = [
      ...store.sessions.map((s): HistoryItem => ({ kind: 'session', date: s.date, session: s })),
      ...store.runs.map((r): HistoryItem => ({ kind: 'run', date: r.date, run: r })),
    ];
    return list.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 40);
  }, [store.sessions, store.runs]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={type.hero}>History</Text>
        <Pressable onPress={() => setChooserOpen(true)} style={styles.addBtn}>
          <Text style={styles.addBtnText}>+ Log</Text>
        </Pressable>
      </View>

      {items.length === 0 ? (
        <Text style={styles.empty}>Your workouts and runs appear here.</Text>
      ) : (
        <View style={{ gap: 8 }}>
          {items.map((item) => {
            if (item.kind === 'run') {
              const r = item.run;
              const pace = fmtPace(paceSecPerKm(r));
              return (
                <Pressable
                  key={r.id}
                  onPress={() => (r.source === 'manual' ? setEditingRun(r) : undefined)}
                  style={styles.row}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.kind, { color: RUN_COLOR }]}>
                      RUNNING{r.source === 'health' ? ' · HEALTH' : ''}
                    </Text>
                    <Text style={styles.title}>
                      {r.distanceKm.toFixed(r.distanceKm >= 10 ? 1 : 2)} km run
                    </Text>
                    <Text style={styles.meta}>
                      {fmtDate(r.date)} · {fmtDuration(r.durationSec)} · {pace}
                    </Text>
                  </View>
                  <View style={styles.rowRight}>
                    <Text style={[styles.reps, mono]}>
                      {r.distanceKm.toFixed(1)}
                      <Text style={styles.repsWord}> km</Text>
                    </Text>
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        deleteRun(r.id);
                      }}
                      hitSlop={10}
                      style={styles.deleteBtn}
                    >
                      <Text style={styles.deleteText}>×</Text>
                    </Pressable>
                  </View>
                </Pressable>
              );
            }
            const s = item.session;
            const reps = s.sets.reduce((sum, x) => sum + x.actualReps, 0);
            return (
              <Pressable key={s.id} onPress={() => setEditing(s)} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.kind, { color: KIND_COLOR[s.dayKind] ?? theme.textDim }]}>
                    {DAY_LABEL[s.dayKind] ?? s.dayKind.toUpperCase()}
                  </Text>
                  <Text style={styles.title}>{DAY_TITLE[s.dayKind] ?? s.dayKind}</Text>
                  <Text style={styles.meta}>
                    {fmtDate(s.date)} · {detailFor(s)}
                  </Text>
                </View>
                <View style={styles.rowRight}>
                  <Text style={[styles.reps, mono]}>
                    {reps}
                    <Text style={styles.repsWord}> reps</Text>
                  </Text>
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      deleteSession(s.id);
                    }}
                    hitSlop={10}
                    style={styles.deleteBtn}
                  >
                    <Text style={styles.deleteText}>×</Text>
                  </Pressable>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      <Pressable onPress={() => setTrashOpen(!trashOpen)} style={styles.trashToggle}>
        <Text style={styles.trashToggleText}>
          {trashOpen ? 'Hide trash' : `Trash (${store.trash.length})`}
        </Text>
      </Pressable>
      {trashOpen ? (
        <View style={{ gap: 8 }}>
          {store.trash.length === 0 ? (
            <Text style={styles.trashEmpty}>
              Trash is empty. Deleted pull-up sessions can be recovered here.
            </Text>
          ) : (
            <>
              {store.trash.map((s) => (
                <View key={s.id} style={styles.trashRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title}>{DAY_TITLE[s.dayKind] ?? s.dayKind}</Text>
                    <Text style={styles.meta}>
                      {fmtDate(s.date)} · {detailFor(s)}
                    </Text>
                  </View>
                  <Pressable onPress={() => restoreSession(s.id)} style={styles.restoreBtn}>
                    <Text style={styles.restoreText}>Restore</Text>
                  </Pressable>
                </View>
              ))}
              <Pressable onPress={emptyTrash} style={{ alignItems: 'center', paddingVertical: 8 }}>
                <Text style={styles.emptyTrash}>Empty trash</Text>
              </Pressable>
            </>
          )}
        </View>
      ) : null}

      {/* what kind of entry? */}
      <Sheet visible={chooserOpen} onClose={() => setChooserOpen(false)} title="Log">
        <Pressable
          onPress={() => {
            setChooserOpen(false);
            setLogOpen(true);
          }}
          style={styles.chooseRow}
        >
          <Text style={[styles.chooseKind, { color: theme.accent }]}>PULL-UPS</Text>
          <Text style={styles.chooseTitle}>Pull-up workout</Text>
          <Text style={styles.chooseMeta}>Sets and reps, done outside the app</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            setChooserOpen(false);
            setRunLogOpen(true);
          }}
          style={styles.chooseRow}
        >
          <Text style={[styles.chooseKind, { color: RUN_COLOR }]}>RUNNING</Text>
          <Text style={styles.chooseTitle}>Run</Text>
          <Text style={styles.chooseMeta}>Distance and time — Health-synced runs import automatically</Text>
        </Pressable>
      </Sheet>

      <ManualLog
        visible={logOpen}
        defaultLoadKg={profile.equipment.fixedLoadKg}
        onClose={() => setLogOpen(false)}
        onSave={(session) => {
          editSession(session);
          setLogOpen(false);
        }}
      />
      <ManualLog
        visible={editing !== null}
        defaultLoadKg={profile.equipment.fixedLoadKg}
        initial={editing ?? undefined}
        onClose={() => setEditing(null)}
        onSave={(session) => {
          editSession(session);
          setEditing(null);
        }}
      />
      <RunLog
        visible={runLogOpen}
        onClose={() => setRunLogOpen(false)}
        onSave={(run) => {
          addRun(run);
          setRunLogOpen(false);
        }}
      />
      <RunLog
        visible={editingRun !== null}
        initial={editingRun ?? undefined}
        onClose={() => setEditingRun(null)}
        onSave={(run) => {
          editRun(run);
          setEditingRun(null);
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  content: { padding: theme.pad, gap: 12, paddingBottom: 120 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  addBtn: {
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  addBtnText: { color: theme.accent, fontSize: 13, fontWeight: '600' },
  empty: { color: theme.textFaint, fontSize: 13 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: theme.radius,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  kind: { fontSize: 10.5, fontWeight: '600', letterSpacing: 0.7, color: theme.textDim },
  title: { fontSize: 14.5, fontWeight: '600', color: theme.text, marginTop: 3 },
  meta: { fontSize: 12, color: theme.textFaint, marginTop: 2 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reps: { fontSize: 13, color: theme.textDim },
  repsWord: { color: theme.textFaint, fontSize: 10 },
  deleteBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: { color: theme.textFaint, fontSize: 16 },
  trashToggle: { alignItems: 'center', paddingVertical: 8 },
  trashToggleText: { color: theme.textDim, fontSize: 13, fontWeight: '600' },
  trashRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.cardMuted,
    borderWidth: 1,
    borderColor: theme.border,
    borderStyle: 'dashed',
    borderRadius: theme.radius,
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 10,
  },
  restoreBtn: {
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  restoreText: { color: theme.accent, fontSize: 12.5, fontWeight: '600' },
  trashEmpty: { color: theme.textFaint, fontSize: 12.5, textAlign: 'center', paddingVertical: 8 },
  emptyTrash: { color: theme.danger, fontSize: 12 },
  chooseRow: {
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: theme.radiusLg,
    padding: 16,
    marginBottom: 10,
  },
  chooseKind: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.8 },
  chooseTitle: { fontSize: 16, fontWeight: '700', color: theme.text, marginTop: 4 },
  chooseMeta: { fontSize: 12.5, color: theme.textFaint, marginTop: 2 },
});
