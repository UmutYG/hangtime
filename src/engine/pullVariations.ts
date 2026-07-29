// The pull-up movement library — pure logic, no RN imports.
//
// Same rule as the push-up library: variations belong on volume and ladder
// days only. Heavy vest days, max days and tests stay standard overhand
// pull-ups, because those are the numbers the whole program is derived from
// and they have to mean the same thing every time.
//
// Rep targets scale by how much harder each shape is than a standard pull-up.
// The scales are conservative — a bad estimate here shows up as a session you
// can't finish, which the autoregulation would then read as fatigue.

import { masteryPath, PushMasteryTier, PushVariation } from './pushups';
import { LoggedSession, ProgramState } from './types';

/** Same shape as the push library so the mastery UI can render either. */
export type PullVariation = PushVariation;

export const PULL_VARIATIONS: PullVariation[] = [
  {
    key: 'standard',
    name: 'Standard',
    scale: 1,
    flavor: 'overhand, shoulder-width — the baseline everything is measured against',
  },
  {
    key: 'chinup',
    name: 'Chin-up',
    scale: 1.15,
    flavor: 'palms toward you — more biceps, and usually a few more reps',
  },
  {
    key: 'neutral',
    name: 'Neutral grip',
    scale: 1.1,
    flavor: 'palms facing each other — the kindest grip on the elbows',
  },
  {
    key: 'wide',
    name: 'Wide grip',
    scale: 0.8,
    flavor: 'hands well outside the shoulders — lats do more, arms do less',
  },
  {
    key: 'close',
    name: 'Close grip',
    scale: 1.05,
    flavor: 'hands almost touching — lower lat and a longer pull',
  },
  {
    key: 'tempo',
    name: 'Tempo 3-1-3',
    scale: 0.55,
    flavor: '3 s up, 1 s hold at the top, 3 s down — control over momentum',
  },
  {
    key: 'lsit',
    name: 'L-sit',
    scale: 0.5,
    flavor: 'legs held straight out — the whole midsection joins in',
  },
  {
    key: 'chestbar',
    name: 'Chest-to-bar',
    scale: 0.65,
    flavor: 'pull until your chest touches — full range, no half reps',
  },
  {
    key: 'archer',
    name: 'Archer',
    scale: 0.35,
    flavor: 'one arm pulls, the other stays long — the honest road to a one-arm',
  },
  {
    key: 'towel',
    name: 'Towel grip',
    scale: 0.6,
    flavor: 'hang from a towel over the bar — grip and forearms become the limit',
  },
];

/** Grip changes only — safe to rotate mid-session without turning it into a skill day. */
export const PULL_SIMPLE_KEYS = ['standard', 'chinup', 'neutral', 'close'] as const;

export function pullVariation(key: string): PullVariation {
  return PULL_VARIATIONS.find((v) => v.key === key) ?? PULL_VARIATIONS[0];
}

/** Deterministic rotation for ladder day — skips standard so play days bring something new. */
export function pullVariationFor(state: ProgramState, slot = 0): PullVariation {
  const pool = PULL_VARIATIONS.slice(1);
  const idx = (state.cycle * 5 + state.week * 3 + state.sessionInWeek + slot) % pool.length;
  return pool[idx];
}

export interface PullVolumeBlock {
  variation: PullVariation;
  sets: number;
  reps: number;
}

/**
 * Split a volume day into 2–3 contiguous grip blocks, deterministically.
 * `baseReps` is the already-tuned target for a standard pull-up.
 */
export function pullVolumeBlocks(
  state: ProgramState,
  totalSets: number,
  baseReps: number
): PullVolumeBlock[] {
  const pool = PULL_SIMPLE_KEYS.map(pullVariation);
  const seed = state.cycle * 5 + state.week * 3 + state.sessionInWeek;
  const blockCount = 2 + (seed % 2);
  const base = Math.floor(totalSets / blockCount);
  const remainder = totalSets % blockCount;
  const start = seed % pool.length;
  const step = seed % 2 === 0 ? 1 : 3; // both coprime with 4 → no repeated grip
  return Array.from({ length: blockCount }, (_, b) => {
    const variation = pool[(start + b * step) % pool.length];
    return {
      variation,
      sets: base + (b < remainder ? 1 : 0),
      reps: Math.max(2, Math.round(baseReps * variation.scale)),
    };
  });
}

// ——— mastery path ———
// Celebratory only. Nothing here feeds the program.
export const PULL_TIERS: Array<{ title: string; keys: string[] }> = [
  { title: 'Grips', keys: ['standard', 'chinup', 'neutral', 'close'] },
  { title: 'Range & control', keys: ['wide', 'chestbar', 'tempo'] },
  { title: 'Whole body', keys: ['lsit', 'towel'] },
  { title: 'One arm', keys: ['archer'] },
];
export const PULL_TIER_THRESHOLDS = [0, 400, 1000, 2000];

export function pullMasteryPath(sessions: LoggedSession[]): PushMasteryTier[] {
  return masteryPath(sessions, PULL_TIERS, PULL_TIER_THRESHOLDS, PULL_VARIATIONS);
}
