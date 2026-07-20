// Cross-modal training load & readiness — pure logic, no React Native imports.
//
// One body, three training spaces. A hard pull-up day is not free when push-up
// day comes around, and this module is where that lives.
//
// Method (all established, none invented):
// - Session load = duration × RPE (Foster's session-RPE, the most widely
//   validated "internal load" metric). Duration comes from the session's own
//   sets and rests; RPE from the day type, adjusted by the effort you logged.
// - Acute fatigue decays exponentially (half-life ~2 days), measured against
//   your own 28-day average load rather than any absolute scale.
// - Cross-modal carryover uses an overlap matrix, NOT a flat penalty:
//   pull and push are antagonists — low muscular overlap, but shared recovery
//   capacity and shoulder/elbow joint stress. Running's interference with
//   upper-body strength is mostly systemic (the concurrent-training effect is
//   strongest for lower-body strength).
//
// The output is advisory and always explained. It never silently rewrites your
// program — it pre-selects the readiness chip you can override in one tap.

import { Effort, ISODate, LoggedSession, Readiness } from './types';
import { Run, paceSecPerKm } from './runs';

export type Modality = 'pull' | 'push' | 'run';

export interface LoadEntry {
  date: ISODate;
  modality: Modality;
  load: number;
  label: string;
}

/** How much a session in one modality taxes readiness in another (0–1). */
export const OVERLAP: Record<Modality, Record<Modality, number>> = {
  // rows: the session you did · cols: the modality you're about to train
  pull: { pull: 1.0, push: 0.35, run: 0.15 },
  push: { push: 1.0, pull: 0.35, run: 0.15 },
  run: { run: 1.0, pull: 0.2, push: 0.2 },
};

/** Baseline session RPE by day type — before your logged effort adjusts it. */
export function baseRpe(dayKind: string): number {
  if (dayKind.includes('Deload') || dayKind.includes('deload')) return 4;
  if (['max', 'testBw', 'testWeighted', 'pushMax', 'pushTest'].includes(dayKind)) return 9;
  if (['heavy', 'pushPyramid', 'calibration'].includes(dayKind)) return 8;
  if (['ladder', 'pushLadder'].includes(dayKind)) return 6.5;
  if (['volume', 'pushVolume'].includes(dayKind)) return 6;
  return 7; // custom / manual logs
}

const EFFORT_ADJ: Record<Effort, number> = { easy: -1, right: 0, grind: 1 };

/** Estimated wall-clock minutes: ~3 s per rep plus the prescribed rests. */
export function sessionDurationMin(session: LoggedSession): number {
  const reps = session.sets.reduce((sum, s) => sum + s.actualReps, 0);
  const workSec = reps * 3;
  // rests aren't stored on the log, so approximate from set count and day type
  const restPerSet = baseRpe(session.dayKind) >= 8 ? 150 : 60;
  const restSec = Math.max(0, session.sets.length - 1) * restPerSet;
  return Math.max(4, Math.round((workSec + restSec) / 60));
}

export function sessionLoad(session: LoggedSession): number {
  const rpe = Math.max(
    3,
    Math.min(10, baseRpe(session.dayKind) + (session.lastSetEffort ? EFFORT_ADJ[session.lastSetEffort] : 0))
  );
  return Math.round(sessionDurationMin(session) * rpe);
}

/** Runs: duration × RPE, where RPE rises as the run approaches your best pace. */
export function runLoad(run: Run, bestPaceSecPerKm: number | null): number {
  const minutes = run.durationSec / 60;
  let rpe = 6;
  const pace = paceSecPerKm(run);
  if (pace !== null && bestPaceSecPerKm !== null && bestPaceSecPerKm > 0) {
    const ratio = pace / bestPaceSecPerKm; // 1.0 = at your best pace
    if (ratio <= 1.05) rpe = 9;
    else if (ratio <= 1.15) rpe = 7.5;
    else if (ratio >= 1.4) rpe = 5;
  }
  if (minutes > 75) rpe += 0.5; // long runs cost more than pace suggests
  return Math.round(minutes * rpe);
}

function daysBetween(fromIso: ISODate, toIso: ISODate): number {
  const a = new Date(fromIso + 'T12:00:00').getTime();
  const b = new Date(toIso + 'T12:00:00').getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

/** Exponential decay of acute fatigue — half-life 2 days. */
function decay(daysAgo: number): number {
  return Math.pow(0.5, daysAgo / 2);
}

/** Recovery capacity floor, in load units — roughly one hard session per day. */
const BASE_CAPACITY = 420;

export interface ReadinessResult {
  /** 0–100; 100 = fully recovered for this modality */
  score: number;
  level: 'fresh' | 'ready' | 'moderate' | 'fatigued';
  /** pre-selects the session readiness chip; undefined = train as planned */
  suggestion: Readiness | undefined;
  reasons: string[];
  /** last 7 days ÷ 28-day average (load ratio); null until ~a week of data */
  loadRatio: number | null;
  daysSinceSame: number | null;
}

export interface ExternalReadiness {
  /** 0–100 from a wearable (Oura readiness, Whoop recovery, …) */
  score: number;
  source: string;
  date: ISODate;
}

const MODALITY_NAME: Record<Modality, string> = {
  pull: 'Pull-ups',
  push: 'Push-ups',
  run: 'Running',
};

export function computeReadiness(
  modality: Modality,
  entries: LoadEntry[],
  today: ISODate,
  external?: ExternalReadiness | null
): ReadinessResult {
  const recent = entries.filter((e) => daysBetween(e.date, today) <= 28 && e.date <= today);

  // weighted acute fatigue for THIS modality
  let acute = 0;
  for (const e of recent) {
    const d = daysBetween(e.date, today);
    if (d > 10) continue;
    acute += e.load * OVERLAP[e.modality][modality] * decay(d);
  }

  const total28 = recent.reduce((sum, e) => sum + e.load, 0);
  const daysOfData = recent.length > 0 ? Math.min(28, daysBetween(recent[0].date, today) + 1) : 0;
  const chronicDaily = daysOfData >= 7 ? total28 / 28 : 0;
  // Capacity ≈ what a few days of your normal training weighs. It only ever
  // GROWS with training history — a thin log must never make you look fragile.
  const capacity = Math.max(BASE_CAPACITY, chronicDaily * 3.5);

  const score = Math.round(100 * Math.max(0, Math.min(1, 1 - acute / capacity)));

  const last7 = recent
    .filter((e) => daysBetween(e.date, today) <= 7)
    .reduce((sum, e) => sum + e.load, 0);
  const loadRatio = chronicDaily > 0 ? Math.round((last7 / (chronicDaily * 7)) * 100) / 100 : null;

  const sameMod = recent.filter((e) => e.modality === modality);
  const daysSinceSame =
    sameMod.length > 0 ? daysBetween(sameMod[sameMod.length - 1].date, today) : null;

  // blend a wearable score when present (equal weight, honest and simple)
  let finalScore = score;
  const reasons: string[] = [];
  if (external && daysBetween(external.date, today) <= 1) {
    finalScore = Math.round((score + external.score) / 2);
    reasons.push(
      `${external.source} says ${external.score}/100 today — blended with your training load.`
    );
  }

  // ——— plain-English reasons ———
  const yesterdayCross = recent
    .filter((e) => e.modality !== modality && daysBetween(e.date, today) <= 1 && e.load >= 150)
    .sort((a, b) => b.load - a.load)[0];

  if (daysSinceSame === 0) {
    reasons.push(`You already trained ${MODALITY_NAME[modality].toLowerCase()} today.`);
  } else if (daysSinceSame === 1) {
    reasons.push(`${MODALITY_NAME[modality]} yesterday — same pattern, so carryover is real.`);
  } else if (daysSinceSame !== null && daysSinceSame >= 5) {
    reasons.push(`${daysSinceSame} days since your last ${MODALITY_NAME[modality].toLowerCase()} session — you're rested.`);
  }

  if (yesterdayCross) {
    const from = yesterdayCross.modality;
    if ((from === 'pull' && modality === 'push') || (from === 'push' && modality === 'pull')) {
      reasons.push(
        `${MODALITY_NAME[from]} yesterday. Opposite movement — the muscles are fresh, but shoulders, elbows and overall recovery are shared.`
      );
    } else if (from === 'run') {
      reasons.push('You ran recently — mostly systemic fatigue, upper body is largely unaffected.');
    } else {
      reasons.push(`${MODALITY_NAME[from]} yesterday adds some systemic fatigue.`);
    }
  }

  if (loadRatio !== null && loadRatio >= 1.5) {
    reasons.push(
      `Your last 7 days are ${loadRatio}× your usual load — a big jump. Easing off today is the smart play.`
    );
  } else if (loadRatio !== null && loadRatio <= 0.6 && daysOfData >= 14) {
    reasons.push(`Lighter than usual week (${loadRatio}× normal) — room to push.`);
  }

  const level: ReadinessResult['level'] =
    finalScore >= 75 ? 'fresh' : finalScore >= 55 ? 'ready' : finalScore >= 35 ? 'moderate' : 'fatigued';

  if (reasons.length === 0) {
    reasons.push(
      level === 'fresh'
        ? 'Nothing heavy in your recent log — full send.'
        : 'Based on your recent training load across all three spaces.'
    );
  }

  const suggestion: Readiness | undefined =
    level === 'fatigued' ? 'rough' : level === 'moderate' ? 'ok' : undefined;

  return { score: finalScore, level, suggestion, reasons, loadRatio, daysSinceSame };
}

export interface WeeklyLoad {
  pull: number;
  push: number;
  run: number;
  total: number;
}

export function weeklyLoad(entries: LoadEntry[], today: ISODate): WeeklyLoad {
  const out: WeeklyLoad = { pull: 0, push: 0, run: 0, total: 0 };
  for (const e of entries) {
    if (daysBetween(e.date, today) > 7 || e.date > today) continue;
    out[e.modality] += e.load;
    out.total += e.load;
  }
  return out;
}

/** Build the unified timeline the readiness math runs on. */
export function buildLoadEntries(
  pullSessions: LoggedSession[],
  pushSessions: LoggedSession[],
  runs: Run[],
  bestPaceSecPerKm: number | null
): LoadEntry[] {
  const entries: LoadEntry[] = [
    ...pullSessions.map((s) => ({
      date: s.date,
      modality: 'pull' as Modality,
      load: sessionLoad(s),
      label: s.dayKind,
    })),
    ...pushSessions.map((s) => ({
      date: s.date,
      modality: 'push' as Modality,
      load: sessionLoad(s),
      label: s.dayKind,
    })),
    ...runs.map((r) => ({
      date: r.date,
      modality: 'run' as Modality,
      load: runLoad(r, bestPaceSecPerKm),
      label: `${r.distanceKm} km`,
    })),
  ];
  return entries.sort((a, b) => a.date.localeCompare(b.date));
}
