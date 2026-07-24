// Push-up engine — pure logic, no React Native imports.
//
// Built from the same researched, outcome-proven methods as the pull-up engine:
// - "One Hundred Push-ups" (Steve Speirs): ascending pyramid sets finished by an
//   all-out set, 3 days/week, periodic retests that re-place you in the program.
// - K Boges sub-max volume: many easy sets at ~50% of max, short rests.
// - Max-effort + ladder days (Pavel-style density work) for the third slot.
// - 4-week cycles: 3 build weeks, then deload + fresh max test — identical
//   periodization skeleton to the pull-up engine, which is the point: one
//   trustworthy system, applied per exercise.
//
// Every session self-tunes from your latest all-out set. No AI, no guesses.

import { Decision, ISODate, LoggedSession, PlannedSet, PR, PushState, SessionPlan } from './types';

export const PUSH_VOLUME_SETS = 10;
export const PUSH_VOLUME_PCT = 0.5;
export const PUSH_VOLUME_REST = 60;
export const PUSH_PYRAMID_REST = 90;
export const PUSH_MAX_SETS = 3;
export const PUSH_MAX_REST = 180;
export const PUSH_LADDER_COUNT = 4;
export const PUSH_LADDER_RUNG_REST = 20;
export const PUSH_LADDER_REST = 90;
export const PUSH_LADDER_TOP = (bestMax: number) => Math.min(12, Math.max(5, Math.round(bestMax * 0.3)));
/** Speirs-style pyramid as fractions of current best max; last set is all-out */
export const PUSH_PYRAMID_FRACTIONS = [0.5, 0.6, 0.5, 0.4];

// ——— variation library ———
// Measurement days (pyramid finisher, max, test) stay STANDARD so the numbers
// never lie. Volume and ladder days rotate variations: same proven dose,
// different shapes — training the body's full capacity is the fun part.
export interface PushVariation {
  key: string;
  name: string;
  /** rep scaler vs standard push-ups (harder variation → fewer reps) */
  scale: number;
  /** what it builds — shown in the "why" */
  flavor: string;
}

export const PUSH_VARIATIONS: PushVariation[] = [
  { key: 'standard', name: 'Standard', scale: 1, flavor: 'the baseline — crisp full-range reps, chest to floor' },
  { key: 'wide', name: 'Wide-grip', scale: 0.9, flavor: 'opens the chest and loads the pecs through a wider arc' },
  { key: 'diamond', name: 'Diamond', scale: 0.7, flavor: 'hands together — triceps and the inner chest line' },
  { key: 'staggered', name: 'Staggered', scale: 0.8, flavor: 'offset hands — anti-rotation control, swap sides each set' },
  { key: 'tempo', name: 'Tempo 3-1-3', scale: 0.6, flavor: '3 s down, 1 s pause, 3 s up — time under tension, total control' },
  { key: 'decline', name: 'Decline (feet up)', scale: 0.75, flavor: 'feet elevated — upper chest and shoulders take over' },
  { key: 'pike', name: 'Pike', scale: 0.6, flavor: 'hips high — shoulder strength, the road toward handstand work' },
  { key: 'archer', name: 'Archer', scale: 0.4, flavor: 'one arm does the work — the honest path to a one-arm push-up' },
  { key: 'explosive', name: 'Explosive', scale: 0.5, flavor: 'push hard enough for the hands to leave the floor — pure power' },
];

/** deterministic rotation — same session position always gets the same variation */
export function pushVariationFor(state: PushState, slot: number = 0): PushVariation {
  // skip 'standard' (index 0) so rotation days always bring something new
  const pool = PUSH_VARIATIONS.slice(1);
  const idx = (state.cycle * 5 + state.week * 3 + state.sessionInWeek + slot) % pool.length;
  return pool[idx];
}

// ——— volume-day grip blocks ———
// Simple grip/stance changes only: nothing that turns a rhythm day into a
// skill session. The fancy shapes live on ladder day, one per ladder.
export const PUSH_SIMPLE_KEYS = ['standard', 'wide', 'diamond', 'staggered'] as const;

export interface PushVolumeBlock {
  variation: PushVariation;
  /** contiguous sets in this block */
  sets: number;
  /** per-set target, scale-adjusted from the same 50%-of-max base */
  reps: number;
}

/** Split a volume day into 2–3 contiguous grip blocks, deterministically. */
export function pushVolumeBlocks(state: PushState, totalSets: number, bestMax: number): PushVolumeBlock[] {
  const simplePool = PUSH_SIMPLE_KEYS.map((k) => PUSH_VARIATIONS.find((v) => v.key === k)!);
  const seed = state.cycle * 5 + state.week * 3 + state.sessionInWeek;
  const blockCount = 2 + (seed % 2);
  const base = Math.floor(totalSets / blockCount);
  const remainder = totalSets % blockCount;
  // start/step both derived from the seed; step 1 or 3 is coprime with 4,
  // so blocks within one session never repeat a grip
  const start = seed % simplePool.length;
  const step = seed % 2 === 0 ? 1 : 3;
  return Array.from({ length: blockCount }, (_, b) => {
    const variation = simplePool[(start + b * step) % simplePool.length];
    return {
      variation,
      sets: base + (b < remainder ? 1 : 0),
      reps: Math.max(3, Math.ceil(bestMax * PUSH_VOLUME_PCT * variation.scale)),
    };
  });
}

export function initialPushState(startingMax: number): PushState {
  return {
    bestMaxSet: startingMax,
    lastTestReps: startingMax,
    cycle: 1,
    week: 1,
    sessionInWeek: 1,
    lastSessionDate: null,
  };
}

export function resolvePushDayKind(state: PushState): SessionPlan['dayKind'] {
  if (state.week === 4) {
    return state.sessionInWeek === 3 ? 'pushTest' : 'pushDeload';
  }
  if (state.sessionInWeek === 1) return 'pushPyramid';
  if (state.sessionInWeek === 2) return 'pushVolume';
  return state.week === 2 ? 'pushLadder' : 'pushMax';
}

const TITLES: Record<string, string> = {
  pushPyramid: 'Pyramid Day — push-ups',
  pushVolume: 'Volume Day — sub-max sets',
  pushMax: 'Max Day — all-out sets',
  pushLadder: 'Ladder Day',
  pushDeload: 'Deload — easy volume',
  pushTest: 'TEST — max push-ups',
};

function why(dayKind: string, state: PushState, rough: boolean): { why: string; whyDetail: string; decisions: Decision[] } {
  const m = state.bestMaxSet;
  switch (dayKind) {
    case 'pushPyramid':
      return {
        why: `Climb ${Math.round(m * 0.5)} → ${Math.round(m * 0.6)}, back down, then one all-out set. The all-out set retunes every number in the program.`,
        whyDetail:
          'This is the One Hundred Push-ups structure: ascending sets prime you without exhausting you, and the final max-effort set drives adaptation while telling the engine exactly where you are. Reviewed outcomes of this program are why it has survived since 2008.',
        decisions: [{ code: 'SUBMAX_DERIVED', params: { sets: 5, reps: Math.round(m * 0.5), bestMax: m } }],
      };
    case 'pushVolume': {
      const n = rough ? PUSH_VOLUME_SETS - 2 : PUSH_VOLUME_SETS;
      const blocks = pushVolumeBlocks(state, n, m);
      const blockText = blocks.map((b) => `${b.sets}×${b.reps} ${b.variation.name.toLowerCase()}`).join(', ');
      return {
        why: `${n} sets in ${blocks.length} blocks — ${blockText}. Same proven dose, shifting shapes.`,
        whyDetail:
          'K Boges sub-max volume, split into grip blocks: the dose comes from your max (50 %, scaled per shape), the variety comes from shifting your hands. Simple grips only — the rhythm stays, the stimulus moves around the chest, triceps and shoulders.',
        decisions: [{ code: 'SUBMAX_DERIVED', params: { sets: n, reps: blocks[0].reps, bestMax: m } }],
      };
    }
    case 'pushMax':
      return {
        why: '3 all-out sets, full rests. This is where your max moves — and where the engine measures it.',
        whyDetail:
          'Max-effort sets with complete recovery train your nervous system to express strength-endurance. Your best set today becomes the new baseline for volume and pyramid days.',
        decisions: [{ code: 'MAX_DAY', params: {} }],
      };
    case 'pushLadder':
      return {
        why: `Play day: ${PUSH_LADDER_COUNT} ladders, each a different push-up variation. Climb 1, 2, 3… stop a ladder early if the next rung is in doubt.`,
        whyDetail:
          'Pavel-style ladders with a twist — every ladder rotates to a new variation from the library, so you sample the whole range of what your body can do while the total volume stays submaximal and crisp. Never to failure; every rep should look good.',
        decisions: [{ code: 'LADDER_DAY', params: { topRung: PUSH_LADDER_TOP(m) } }],
      };
    case 'pushDeload':
      return {
        why: 'Week 4: planned deload. Half the volume, easy pace — this week cements the last three.',
        whyDetail:
          'Fatigue masks fitness. Cutting volume ~50 % lets accumulated fatigue drain while adaptations stay, which is why the test at the end of this week usually sets a PR.',
        decisions: [{ code: 'DELOAD_SCHEDULED', params: {} }],
      };
    default: // pushTest
      return {
        why: 'Test day: one all-out max set, fresh. This number recalibrates the whole program.',
        whyDetail:
          'Tests only happen after the deload so fatigue can’t hide your progress. The result re-derives every set target and updates your goal ETA — honestly.',
        decisions: [{ code: 'TEST_BW', params: {} }],
      };
  }
}

export function generatePushSession(state: PushState, readiness?: string): SessionPlan {
  const dayKind = resolvePushDayKind(state);
  const m = Math.max(5, state.bestMaxSet);
  const rough = readiness === 'rough';
  let sets: PlannedSet[] = [];

  switch (dayKind) {
    case 'pushPyramid': {
      const fr = PUSH_PYRAMID_FRACTIONS;
      sets = fr.map((f, i) => ({
        targetReps: Math.max(3, Math.round(m * f)),
        loadKg: 0,
        restSecAfter: PUSH_PYRAMID_REST,
      }));
      sets.push({
        targetReps: Math.max(3, Math.round(m * 0.6)),
        loadKg: 0,
        amrap: true,
        restSecAfter: 0,
        note: 'Last set: as many clean reps as you have — this recalibrates your targets.',
      });
      if (rough) sets = sets.slice(1);
      break;
    }
    case 'pushVolume': {
      const n = rough ? PUSH_VOLUME_SETS - 2 : PUSH_VOLUME_SETS;
      const blocks = pushVolumeBlocks(state, n, m);
      for (const block of blocks) {
        for (let i = 0; i < block.sets; i++) {
          sets.push({
            targetReps: block.reps,
            loadKg: 0,
            restSecAfter: PUSH_VOLUME_REST,
            variation: { key: block.variation.key, name: block.variation.name, flavor: block.variation.flavor },
            note: i === 0 ? `${block.variation.name} push-ups — ${block.variation.flavor}.` : undefined,
          });
        }
      }
      if (sets.length > 0) sets[sets.length - 1].restSecAfter = 0;
      break;
    }
    case 'pushMax': {
      sets = [
        { targetReps: Math.max(3, Math.round(m * 0.4)), loadKg: 0, isWarmup: true, restSecAfter: 90 },
        ...Array.from({ length: PUSH_MAX_SETS }, (_, i) => ({
          targetReps: Math.max(3, m - 3),
          loadKg: 0,
          amrap: true,
          restSecAfter: i === PUSH_MAX_SETS - 1 ? 0 : PUSH_MAX_REST,
          note: 'All-out, but stop when form breaks.',
        })),
      ];
      break;
    }
    case 'pushLadder': {
      const ladders = rough ? PUSH_LADDER_COUNT - 1 : PUSH_LADDER_COUNT;
      for (let l = 0; l < ladders; l++) {
        // every ladder gets its own variation — the play day
        const variation = pushVariationFor(state, l);
        const top = Math.max(3, Math.round(PUSH_LADDER_TOP(m) * variation.scale));
        for (let r = 1; r <= top; r++) {
          sets.push({
            targetReps: r,
            loadKg: 0,
            ladder: { ladderIndex: l + 1, rung: r },
            variation: { key: variation.key, name: variation.name, flavor: variation.flavor },
            restSecAfter:
              r === top ? (l === ladders - 1 ? 0 : PUSH_LADDER_REST) : PUSH_LADDER_RUNG_REST,
            note:
              r === 1 ? `Ladder ${l + 1}: ${variation.name} — ${variation.flavor}.` : undefined,
          });
        }
      }
      break;
    }
    case 'pushDeload': {
      const reps = Math.max(3, Math.ceil(m * 0.4));
      sets = Array.from({ length: 6 }, (_, i) => ({
        targetReps: reps,
        loadKg: 0,
        restSecAfter: i === 5 ? 0 : PUSH_VOLUME_REST,
      }));
      break;
    }
    default: {
      // pushTest
      sets = [
        { targetReps: Math.max(3, Math.round(m * 0.3)), loadKg: 0, isWarmup: true, restSecAfter: 120 },
        {
          targetReps: state.lastTestReps + 2,
          loadKg: 0,
          amrap: true,
          restSecAfter: 0,
          note: 'One set. Everything you have, strict form, chest to floor.',
        },
      ];
    }
  }

  const w = why(dayKind, state, rough);
  return {
    dayKind,
    cycle: state.cycle,
    week: state.week,
    sessionInWeek: state.sessionInWeek,
    title: TITLES[dayKind],
    sets,
    decisions: w.decisions,
    why: w.why,
    whyDetail: w.whyDetail,
    progressionExempt: rough,
  };
}

function advancePush(state: PushState): PushState {
  let { cycle, week, sessionInWeek } = state;
  if (sessionInWeek < 3) sessionInWeek = (sessionInWeek + 1) as 1 | 2 | 3;
  else {
    sessionInWeek = 1;
    if (week === 4) {
      week = 1;
      cycle += 1;
    } else week = (week + 1) as 1 | 2 | 3 | 4;
  }
  return { ...state, cycle, week, sessionInWeek };
}

export function applyPushResult(
  prevState: PushState,
  session: LoggedSession,
  existingPrs: PR[]
): { state: PushState; newPrs: PR[]; repsDone: number } {
  let state: PushState = { ...prevState, lastSessionDate: session.date };
  const newPrs: PR[] = [];
  const repsDone = session.sets.reduce((sum, s) => sum + s.actualReps, 0);
  const best = Math.max(0, ...session.sets.filter((s) => !s.isWarmup).map((s) => s.actualReps));
  const prMax = Math.max(0, ...existingPrs.filter((p) => p.kind === 'pushMax').map((p) => p.value));

  if (session.dayKind === 'pushCustom') {
    if (best > state.bestMaxSet) state.bestMaxSet = best;
    if (best > prMax && best > 0) newPrs.push({ kind: 'pushMax', value: best, date: session.date });
    return { state, newPrs, repsDone }; // manual logs never advance the cycle
  }

  if (!session.progressionExempt) {
    if (['pushMax', 'pushPyramid'].includes(session.dayKind) && best > state.bestMaxSet) {
      state.bestMaxSet = best;
    }
    if (session.dayKind === 'pushTest' && best > 0) {
      state.bestMaxSet = best;
      state.lastTestReps = best;
    }
    if (best > prMax && best > 0 && ['pushMax', 'pushPyramid', 'pushTest'].includes(session.dayKind)) {
      newPrs.push({ kind: 'pushMax', value: best, date: session.date });
    }
  }

  state = advancePush(state);
  return { state, newPrs, repsDone };
}

/** Sessions are the source of truth — replay them to rebuild all derived state. */
export function replayPushAll(
  startingMax: number,
  sessions: LoggedSession[]
): { state: PushState; prs: PR[]; lifetimeReps: number } {
  let state = initialPushState(startingMax);
  const prs: PR[] = [];
  let lifetimeReps = 0;
  for (const session of sessions) {
    const out = applyPushResult(state, session, prs);
    state = out.state;
    prs.push(...out.newPrs);
    lifetimeReps += out.repsDone;
  }
  return { state, prs, lifetimeReps };
}

// ——— movement library / mastery path ———
// Purely celebratory: tiers "open" as work accumulates in earlier ones, but
// nothing in the program generator ever reads this. Reps earned in a tier
// that hasn't opened yet (ladder days rotate the whole pool) still count.
export const PUSH_TIERS: Array<{ title: string; keys: string[] }> = [
  { title: 'Foundation', keys: ['standard', 'wide', 'staggered'] },
  { title: 'Strength lines', keys: ['diamond', 'decline'] },
  { title: 'Control', keys: ['tempo', 'pike'] },
  { title: 'Power', keys: ['explosive', 'archer'] },
];
/** cumulative reps across all EARLIER tiers needed for a tier to open */
export const PUSH_TIER_THRESHOLDS = [0, 300, 800, 1500];

/** lifetime working reps per variation key; legacy sets without a key count as standard */
export function pushVariationTotals(sessions: LoggedSession[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const session of sessions) {
    for (const set of session.sets) {
      if (set.isWarmup) continue;
      const key = set.variationKey ?? 'standard';
      totals[key] = (totals[key] ?? 0) + set.actualReps;
    }
  }
  return totals;
}

export interface PushMasteryTier {
  title: string;
  open: boolean;
  items: Array<{ variation: PushVariation; reps: number }>;
}

export function pushMasteryPath(sessions: LoggedSession[]): PushMasteryTier[] {
  const totals = pushVariationTotals(sessions);
  const tierReps = PUSH_TIERS.map((t) => t.keys.reduce((sum, k) => sum + (totals[k] ?? 0), 0));
  return PUSH_TIERS.map((tier, i) => {
    const earlier = tierReps.slice(0, i).reduce((sum, r) => sum + r, 0);
    return {
      title: tier.title,
      open: earlier >= PUSH_TIER_THRESHOLDS[i],
      items: tier.keys.map((k) => ({
        variation: PUSH_VARIATIONS.find((v) => v.key === k)!,
        reps: totals[k] ?? 0,
      })),
    };
  });
}

export const PUSH_MILESTONES = [40, 50, 60, 80, 100];

/** realistic monthly gain shrinks as the max grows (matches published outcomes) */
export function pushRatePerMonth(max: number): number {
  if (max < 40) return 6;
  if (max < 60) return 4;
  return 2;
}

export function computePushGoal(
  state: PushState,
  todayIso: ISODate
): { label: string; targetValue: number; currentValue: number; etaMonth: string } | null {
  const next = PUSH_MILESTONES.find((v) => v > state.lastTestReps);
  if (!next) return null;
  const months = Math.max(0.5, (next - state.lastTestReps) / pushRatePerMonth(state.lastTestReps));
  const d = new Date(todayIso + 'T12:00:00');
  d.setMonth(d.getMonth() + Math.round(months));
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return {
    label: `${next} push-ups in one set`,
    targetValue: next,
    currentValue: state.lastTestReps,
    etaMonth: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`,
  };
}
