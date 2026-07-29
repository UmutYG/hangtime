// All tunable numbers in one place, sourced from the researched programs.

import type { VolumeTune } from './types';

export const REP_RANGE = { bottom: 4, top: 6 } as const;
export const HEAVY_SETS = 4;
export const HEAVY_REST_SEC = 180;
export const HEAVY_AMRAP_CAP = 8;
export const LOAD_INCREMENT_KG = 2.5;

// Fixed-load (vest) progression: reps fill → 5th set → denser rests → "add load" advice.
// This is how real programs progress a load you cannot change (rep-goal + density methods).
export const FIXED_BASE_SETS = 4;
export const FIXED_MAX_SETS = 5;
export const FIXED_DENSE_REST_SEC = 120;
export const FIXED_REP_SPAN = 3; // bottom of range = top − span
/** top of per-set range: est. max reps at that load minus ~2 RIR, kept sane */
export const FIXED_TOP_REPS = (estMaxReps: number) =>
  Math.min(12, Math.max(5, Math.round(estMaxReps) - 2));

export const VOLUME_SETS = 10;
export const VOLUME_SETS_ROUGH = 8;
export const VOLUME_PCT_OF_MAX = 0.5; // K Boges: 50 % of best max-effort set
export const VOLUME_REST_SEC = 60;

// Volume-day autoregulation — rest-first, deterministic, never past baseline.
// Thresholds mirror velocity-loss research: ≤20 % set-to-set drop = quality zone,
// ≥30 % = failure territory a sub-max day must avoid. Rest is the first lever
// because short rests are what make reps fade across sets (rest-interval studies).
export const VOLUME_REST_STEPS = [60, 75, 90] as const;
export const VOLUME_REP_ADJ_FLOOR = -2;
export const VOLUME_CRISP_COMPLETION = 0.95;
export const VOLUME_CRISP_DROPOFF = 0.8; // ≤20 % drop from first set
export const VOLUME_CRISP_REST_OVERAGE = 1.15;
export const VOLUME_SHORTFALL_COMPLETION = 0.85; // below → breakdown
export const VOLUME_MODERATE_REST_OVERAGE = 1.25;
export const VOLUME_BREAKDOWN_DROPOFF = 0.7; // ≥30 % drop from first set

export function defaultVolumeTune(): VolumeTune {
  return {
    repAdj: 0,
    restSec: VOLUME_REST_SEC,
    lastCompletionPct: null,
    lastDropOff: null,
    lastRestOverage: null,
    lastOutcome: null,
  };
}

export const MAX_DAY_SETS = 3;
export const MAX_DAY_REST_SEC = 300;

export const LADDER_COUNT = 5;
export const LADDER_RUNG_REST_SEC = 30;
export const LADDER_REST_SEC = 120;
/** top rung ≈ 30 % of best max set, kept sane */
export const LADDER_TOP_RUNG = (bestMax: number) =>
  Math.min(6, Math.max(3, Math.round(bestMax * 0.3)));

export const DELOAD_LOAD_FACTOR = 0.85; // heavy deload @ −15 %
export const DELOAD_HEAVY_SETS = 3;
export const DELOAD_HEAVY_REPS = 3;
export const DELOAD_VOLUME_SETS = 6;
export const POST_DELOAD_RESUME_FACTOR = 0.95;

export const FAILS_FOR_DELOAD = 2;
export const GRINDS_FOR_DELOAD = 2;
export const SESSIONS_AT_LOAD_FOR_MICRO = 3;

export const LAYOFF_DAYS = 8; // > 7 days gap triggers ramp-back session
export const LAYOFF_LOAD_FACTOR = 0.95;

/**
 * A test can raise your max freely but only lower it this far in one go.
 * Four weeks of training does not cost 40 % of your strength-endurance, so a
 * huge drop is almost always a bad day (illness, sleep, timing) rather than a
 * true result — and an un-capped drop would drag every volume target with it.
 * A genuinely lower max still gets there, it just takes two tests.
 */
export const TEST_MAX_DROP_FACTOR = 0.85;

/** working load seeded from calibration ≈ a load allowing ~6 clean reps */
export const CALIBRATION_TARGET_REPS = 6;
export const CALIBRATION_E1RM_FACTOR = 0.82;

// Goal engine — research fallback rates
export const RATE_BW_REPS_PER_MONTH = 1.5;
export const RATE_WEIGHTED_KG_PER_MONTH = 2; // on the 5RM

export const BW_REP_MILESTONES = [20, 25, 28, 30];
/** weighted milestones as [fraction of BW, reps] */
export const WEIGHTED_MILESTONES: Array<{ pct: number; reps: number; tag: string }> = [
  { pct: 0.25, reps: 5, tag: 'Intermediate' },
  { pct: 0.33, reps: 5, tag: 'Solid' },
  { pct: 0.5, reps: 1, tag: 'Advanced' },
  { pct: 0.5, reps: 5, tag: 'Advanced-Elite' },
  { pct: 1.0, reps: 1, tag: 'Elite' },
];
