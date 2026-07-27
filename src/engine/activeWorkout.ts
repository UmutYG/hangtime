// An in-progress session, snapshot-able to disk — pure logic, no RN imports.
//
// A workout is 15+ minutes of the app in the foreground with the screen on.
// If iOS reclaims memory or a call interrupts it, everything logged so far is
// gone and the engine never learns the session happened. This type is what we
// write to disk as you go so an interrupted session can be picked back up.

import { Readiness, SessionPlan } from './types';

export interface ActiveWorkout {
  plan: SessionPlan;
  readiness?: Readiness;
  /** ISO datetime the session started — shown on the resume card */
  startedAt: string;
  warmupDone: boolean;
  /** reps logged, keyed by index into plan.sets */
  actuals: Record<number, number>;
  /** measured rest after each set, keyed by index into plan.sets */
  restsTaken: Record<number, number>;
}

/** Which training space owns this session — the resume card belongs on its screen. */
export function workoutMode(w: ActiveWorkout): 'pullups' | 'pushups' {
  return w.plan.dayKind.startsWith('push') ? 'pushups' : 'pullups';
}

export function workoutProgress(w: ActiveWorkout): { logged: number; total: number } {
  const workingIdx = w.plan.sets.map((s, i) => (s.isWarmup ? -1 : i)).filter((i) => i >= 0);
  return {
    logged: workingIdx.filter((i) => w.actuals[i] !== undefined).length,
    total: workingIdx.length,
  };
}

/** Only offer to resume a session that actually got somewhere. */
export function isResumable(w: ActiveWorkout): boolean {
  if (w.plan.sets.length === 0) return false;
  const { logged, total } = workoutProgress(w);
  if (logged >= total) return false; // nothing left to do
  return w.warmupDone || logged > 0;
}

/** Validate anything parsed off disk — a corrupt snapshot must never crash the app. */
export function sanitizeActiveWorkout(raw: unknown): ActiveWorkout | null {
  if (!raw || typeof raw !== 'object') return null;
  const w = raw as Partial<ActiveWorkout>;
  const plan = w.plan as SessionPlan | undefined;
  if (!plan || typeof plan !== 'object' || !Array.isArray(plan.sets) || !plan.dayKind) return null;
  if (typeof w.startedAt !== 'string') return null;
  const nums = (v: unknown): Record<number, number> => {
    if (!v || typeof v !== 'object') return {};
    const out: Record<number, number> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      const idx = Number(k);
      if (Number.isInteger(idx) && typeof val === 'number' && Number.isFinite(val)) out[idx] = val;
    }
    return out;
  };
  return {
    plan,
    readiness: w.readiness,
    startedAt: w.startedAt,
    warmupDone: w.warmupDone === true,
    actuals: nums(w.actuals),
    restsTaken: nums(w.restsTaken),
  };
}
