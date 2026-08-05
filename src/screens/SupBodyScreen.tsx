import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { statusOf, supDayFor } from '../engine/supplements';
import { absorptionNote } from '../engine/absorption';
import {
  SITE_LABEL,
  elapsedLabel,
  journeyFor,
  positionAt,
  type BodySite,
  type Phase,
} from '../engine/pharmacokinetics';
import type { SupplementContext, SupplementItem } from '../engine/types';
import { useStore } from '../hooks/useStore';
import { MECH_COLOR, mono, theme, type } from '../theme';
import { RoofBar } from '../components/RoofBar';
import { BodyFigure } from '../components/BodyFigure';
import { Sheet } from '../components/Sheet';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
function minutesNow(d = new Date()): number {
  return d.getHours() * 60 + d.getMinutes();
}

/** how fully this dose landed → how brightly its marker sits on the figure */
const LANDING_WEIGHT = { full: 1, partial: 0.72, little: 0.42 } as const;

interface Dose {
  item: SupplementItem;
  at: string;
  ctx: SupplementContext | null;
  weight: number;
}

/**
 * The body, live.
 *
 * Every dose logged today is somewhere right now — dissolving, crossing the
 * gut wall, riding the lymph, being pulled into muscle — and this is that,
 * drawn on a body rather than described in a paragraph. Tapping one replays
 * its whole route so the journey is watchable rather than inferred.
 *
 * The old stage cards and 14-day strip are gone on purpose: the same
 * information now lives where it means something, on the part of the body
 * it happens in.
 */
export function SupBodyScreen() {
  const { store } = useStore();
  const items = store.supItems ?? [];
  const days = store.supDays ?? [];
  const today = todayIso();
  const day = supDayFor(days, today);

  const [tick, setTick] = useState(() => minutesNow());
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<SupplementItem | null>(null);
  const [replay, setReplay] = useState<number | null>(null);
  const replayTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Live, but gently — the body doesn't change in a way a second-hand would
  // capture, and a screen that re-renders every second is just a battery cost.
  useEffect(() => {
    const id = setInterval(() => setTick(minutesNow()), 30_000);
    return () => clearInterval(id);
  }, []);

  const doses: Dose[] = useMemo(() => {
    const out: Dose[] = [];
    for (const item of items) {
      if (statusOf(day, item.id) !== 'taken') continue;
      const at = day.taken[item.id];
      const ctx = day.ctx?.[item.id] ?? null;
      const landing = absorptionNote(item, ctx, at, day, items).landing;
      out.push({ item, at, ctx, weight: LANDING_WEIGHT[landing] });
    }
    return out.sort((a, b) => a.at.localeCompare(b.at));
  }, [items, day]);

  const selectedDose = doses.find((d) => d.item.id === selected) ?? null;

  // Replaying sweeps a virtual clock from swallow to settled in about six
  // seconds; live mode just asks where everything is now.
  const startReplay = (dose: Dose) => {
    if (replayTimer.current) clearInterval(replayTimer.current);
    const phases = journeyFor(dose.item, dose.ctx);
    const finite = phases.filter((p) => Number.isFinite(p.to));
    const end = finite.length ? finite[finite.length - 1].to * 1.15 : 240;
    const stepMs = 90;
    const steps = Math.round(6000 / stepMs);
    let i = 0;
    setReplay(0);
    replayTimer.current = setInterval(() => {
      i += 1;
      setReplay((i / steps) * end);
      if (i >= steps) {
        if (replayTimer.current) clearInterval(replayTimer.current);
        replayTimer.current = null;
        setTimeout(() => setReplay(null), 900);
      }
    }, stepMs);
  };

  useEffect(
    () => () => {
      if (replayTimer.current) clearInterval(replayTimer.current);
    },
    []
  );

  // What the figure lights up: one dose while a dose is selected, otherwise
  // everything that's in flight.
  const { sites, caption, subCaption, accent } = useMemo(() => {
    const map: Partial<Record<BodySite, number>> = {};

    if (selectedDose) {
      const phases = journeyFor(selectedDose.item, selectedDose.ctx);
      for (const p of phases) map[p.site] = Math.max(map[p.site] ?? 0, 0.18);
      const phase: Phase =
        replay !== null
          ? positionFromElapsed(phases, replay)
          : (positionAt(selectedDose.item, selectedDose.ctx, selectedDose.at, tick)?.phase ??
            phases[0]);
      map[phase.site] = selectedDose.weight;
      return {
        sites: map,
        caption: phase.label,
        subCaption: SITE_LABEL[phase.site],
        accent: MECH_COLOR[selectedDose.item.mech],
      };
    }

    let moving = 0;
    for (const d of doses) {
      const pos = positionAt(d.item, d.ctx, d.at, tick);
      if (!pos) continue;
      map[pos.phase.site] = Math.max(map[pos.phase.site] ?? 0, d.weight);
      if (!pos.phase.longArc) moving += 1;
    }
    return {
      sites: map,
      caption: doses.length === 0 ? 'Nothing logged yet today' : `${doses.length} logged today`,
      subCaption:
        doses.length === 0
          ? 'Log a dose and it shows up here'
          : moving > 0
            ? `${moving} still on the move`
            : 'all settled where they work',
      accent: theme.supp,
    };
  }, [doses, selectedDose, tick, replay]);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <RoofBar />
        <Text style={type.hero}>Body</Text>

        <View style={styles.figureWrap}>
          <BodyFigure
            active={sites}
            accent={accent}
            size={250}
            onPressSite={(site) => {
              // tapping the body picks whichever dose is at that site
              const hit = doses.find((d) => {
                const p = positionAt(d.item, d.ctx, d.at, tick);
                return p?.phase.site === site;
              });
              if (hit) setSelected(hit.item.id);
            }}
          />
          <Text style={[styles.caption, { color: accent }]}>{caption}</Text>
          <Text style={styles.subCaption}>{subCaption}</Text>
          {selectedDose ? (
            <View style={styles.figureBtns}>
              <Pressable onPress={() => startReplay(selectedDose)} style={styles.ghostBtn}>
                <Text style={styles.ghostBtnText}>
                  {replay !== null ? 'Replaying…' : 'Replay the journey'}
                </Text>
              </Pressable>
              <Pressable onPress={() => setSelected(null)} style={styles.ghostBtn}>
                <Text style={styles.ghostBtnText}>Show all</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {doses.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.emptyText}>
              Nothing logged today yet. Once you do, this shows where each one actually is —
              stomach, gut wall, bloodstream, muscle — and roughly when it gets there.
            </Text>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={[type.kickerDim, { color: theme.supp }]}>RIGHT NOW</Text>
            {doses.map((d, idx) => {
              const pos = positionAt(d.item, d.ctx, d.at, tick);
              const color = MECH_COLOR[d.item.mech];
              const on = selected === d.item.id;
              return (
                <Pressable
                  key={d.item.id}
                  onPress={() => setSelected(on ? null : d.item.id)}
                  onLongPress={() => setDetail(d.item)}
                  style={[styles.row, idx === doses.length - 1 && styles.rowLast]}
                >
                  <View style={[styles.dot, { backgroundColor: color, opacity: on ? 1 : 0.45 }]} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.rowName}>{d.item.name}</Text>
                    <Text style={styles.rowPhase}>
                      {pos ? `${pos.phase.label} · ${SITE_LABEL[pos.phase.site]}` : 'logged'}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 2 }}>
                    <Text style={[styles.rowTime, mono]}>{d.at}</Text>
                    <Text style={styles.rowAgo}>{pos ? elapsedLabel(pos.elapsed) : ''}</Text>
                  </View>
                </Pressable>
              );
            })}
            <Text style={styles.hint}>
              Tap to follow one on the figure. Press and hold for the full story.
            </Text>
          </View>
        )}

        {selectedDose ? (
          <Pressable style={styles.deepBtn} onPress={() => setDetail(selectedDose.item)}>
            <Text style={styles.deepBtnText}>Go deeper on {selectedDose.item.name}</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      {detail ? (
        <DoseDetail
          item={detail}
          ctx={day.ctx?.[detail.id] ?? null}
          at={day.taken[detail.id] ?? null}
          nowMinutes={tick}
          onClose={() => setDetail(null)}
        />
      ) : null}
    </View>
  );
}

/** the phase a virtual elapsed-minutes value falls in — used by replay */
function positionFromElapsed(phases: Phase[], elapsed: number): Phase {
  const idx = phases.findIndex((p) => elapsed < p.to);
  return phases[idx === -1 ? phases.length - 1 : idx];
}

/**
 * The whole route for one supplement, laid out end to end, with where it is
 * now marked on it — plus the reasoning that was already written for it.
 */
function DoseDetail({
  item,
  ctx,
  at,
  nowMinutes,
  onClose,
}: {
  item: SupplementItem;
  ctx: SupplementContext | null;
  at: string | null;
  nowMinutes: number;
  onClose: () => void;
}) {
  const phases = journeyFor(item, ctx);
  const pos = at ? positionAt(item, ctx, at, nowMinutes) : null;
  const accent = MECH_COLOR[item.mech];

  return (
    <Sheet visible onClose={onClose} title={item.name} subtitle={item.slot}>
      <Text style={styles.sheetKicker}>THE ROUTE IT TAKES</Text>
      <View style={styles.timeline}>
        {phases.map((p, i) => {
          const current = pos?.index === i;
          const passed = pos ? i < pos.index : false;
          return (
            <View key={i} style={styles.tlRow}>
              <View style={styles.tlRail}>
                <View
                  style={[
                    styles.tlDot,
                    { borderColor: accent },
                    (current || passed) && { backgroundColor: accent },
                    current && styles.tlDotNow,
                  ]}
                />
                {i < phases.length - 1 ? (
                  <View style={[styles.tlLine, passed && { backgroundColor: accent }]} />
                ) : null}
              </View>
              <View style={styles.tlBody}>
                <View style={styles.tlHead}>
                  <Text style={[styles.tlLabel, current && { color: accent }]}>{p.label}</Text>
                  {current ? <Text style={[styles.tlNow, { color: accent }]}>NOW</Text> : null}
                </View>
                <Text style={styles.tlSite}>
                  {SITE_LABEL[p.site]}
                  {p.longArc
                    ? ' · the long arc'
                    : ` · ${Math.round(p.from)}–${Math.round(p.to)} min`}
                </Text>
                <Text style={styles.tlText}>{p.body}</Text>
              </View>
            </View>
          );
        })}
      </View>

      {item.why ? (
        <>
          <Text style={styles.sheetKicker}>WHY HERE</Text>
          <Text style={styles.sheetBody}>{item.why}</Text>
        </>
      ) : null}
      {item.notice ? (
        <>
          <Text style={styles.sheetKicker}>WHAT TO NOTICE</Text>
          <Text style={styles.sheetBody}>{item.notice}</Text>
        </>
      ) : null}
      <Text style={styles.sheetFoot}>
        Timings are typical, not a measurement — a rough map of where a dose usually is, shifted by
        how you actually took it.
      </Text>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: theme.pad, gap: 12, paddingBottom: 120 },
  figureWrap: { alignItems: 'center', gap: 2, paddingVertical: 4 },
  caption: { fontSize: 13, fontWeight: '700', letterSpacing: 0.7, textTransform: 'uppercase' },
  subCaption: { fontSize: 13.5, color: theme.textDim },
  figureBtns: { flexDirection: 'row', gap: 8, marginTop: 10 },
  ghostBtn: {
    borderWidth: 1,
    borderColor: theme.borderStrong,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  ghostBtnText: { fontSize: 12.5, color: theme.textDim, fontWeight: '600' },
  card: {
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: theme.radiusLg,
    padding: 16,
    gap: 4,
  },
  emptyText: { color: theme.textDim, fontSize: 13.5, lineHeight: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  rowLast: { borderBottomWidth: 0 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  rowName: { fontSize: 14.5, fontWeight: '600', color: theme.text },
  rowPhase: { fontSize: 12, color: theme.textDim },
  rowTime: { fontSize: 11.5, color: theme.textFaint },
  rowAgo: { fontSize: 10.5, color: theme.textFaint, opacity: 0.8 },
  hint: { fontSize: 11.5, color: theme.textFaint, marginTop: 8, lineHeight: 16.5 },
  deepBtn: {
    backgroundColor: theme.dark,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  deepBtnText: { color: theme.onDark, fontSize: 14, fontWeight: '700' },
  sheetKicker: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: theme.textFaint,
    marginTop: 16,
    marginBottom: 6,
  },
  sheetBody: { fontSize: 14, lineHeight: 21, color: theme.text },
  sheetFoot: {
    fontSize: 11.5,
    lineHeight: 17,
    color: theme.textFaint,
    marginTop: 18,
  },
  timeline: { gap: 0 },
  tlRow: { flexDirection: 'row', gap: 12 },
  tlRail: { alignItems: 'center', width: 14 },
  tlDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
    marginTop: 3,
  },
  tlDotNow: { width: 13, height: 13, borderRadius: 7 },
  tlLine: { flex: 1, width: 1.5, backgroundColor: theme.border, marginVertical: 3 },
  tlBody: { flex: 1, paddingBottom: 16, gap: 2 },
  tlHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tlLabel: { fontSize: 14, fontWeight: '700', color: theme.text },
  tlNow: { fontSize: 9.5, fontWeight: '800', letterSpacing: 1 },
  tlSite: { fontSize: 11.5, color: theme.textFaint },
  tlText: { fontSize: 13, lineHeight: 19, color: theme.textDim, marginTop: 3 },
});
