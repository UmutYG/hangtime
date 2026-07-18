import {
  ApplyOutcome,
  LoggedSession,
  PR,
  Profile,
  ProgramState,
  TestPoint,
} from './types';
import * as C from './constants';
import { addedLoadForReps, e1rmSystem, roundToIncrement } from './epley';
import { fixedRepRange, initialState } from './generator';

/**
 * Rebuild all derived state by replaying the session log from scratch.
 * This is what makes history edit/delete safe: sessions are the source of
 * truth; state, PRs, tests and the lifetime counter are projections.
 */
export function replayAll(
  profile: Profile,
  sessions: LoggedSession[]
): { state: ProgramState; prs: PR[]; tests: TestPoint[]; lifetimeReps: number } {
  let state = initialState(profile);
  const prs: PR[] = [];
  const tests: TestPoint[] = [];
  let lifetimeReps = 0;
  for (const session of sessions) {
    const out = applyResult(profile, state, session, prs);
    state = out.state;
    prs.push(...out.newPrs);
    tests.push(...out.newTests);
    lifetimeReps += out.repsDone;
  }
  return { state, prs, tests, lifetimeReps };
}

/** Fixed-vest heavy day: progress reps → add a 5th set → shorten rests → advise more load. */
function applyFixedHeavy(
  profile: Profile,
  prevState: ProgramState,
  state: ProgramState,
  session: LoggedSession
): void {
  const w = state.weighted;
  const range = fixedRepRange(profile, state);
  const working = session.sets.filter((s) => !s.isWarmup && s.loadKg > 0);
  const reps = working.map((s) => s.actualReps);
  const grind = session.lastSetEffort === 'grind';
  const anyCollapse = reps.some((r) => r < range.bottom - 1);
  const allTop = reps.length > 0 && reps.every((r) => r >= range.top);

  if (allTop && !grind) {
    if (w.setCount < C.FIXED_MAX_SETS) w.setCount += 1;
    else if (w.restSec > C.FIXED_DENSE_REST_SEC) w.restSec = C.FIXED_DENSE_REST_SEC;
    else w.suggestMoreLoad = true;
    w.lastReps = Array(w.setCount).fill(range.bottom);
    w.failStreak = 0;
  } else if (anyCollapse) {
    w.failStreak += 1;
    if (w.failStreak >= C.FAILS_FOR_DELOAD) {
      state.pendingDeload = true;
      w.failStreak = 0;
    }
  } else {
    w.lastReps = reps.map((r) => Math.min(range.top, Math.max(range.bottom, r)));
    while (w.lastReps.length < w.setCount) w.lastReps.push(range.bottom);
    w.failStreak = 0;
  }
  w.grindStreak = grind ? w.grindStreak + 1 : 0;
  if (w.grindStreak >= C.GRINDS_FOR_DELOAD) {
    state.pendingDeload = true;
    w.grindStreak = 0;
  }
}

function advance(state: ProgramState): ProgramState {
  let { cycle, week, sessionInWeek } = state;
  let pendingDeload = state.pendingDeload;
  if (sessionInWeek < 3) {
    sessionInWeek = (sessionInWeek + 1) as 1 | 2 | 3;
  } else {
    sessionInWeek = 1;
    if (week === 4 || pendingDeload) {
      // deload/test week finished → new cycle
      week = 1;
      cycle += 1;
      pendingDeload = false;
    } else {
      week = (week + 1) as 1 | 2 | 3 | 4;
    }
  }
  return { ...state, cycle, week, sessionInWeek, pendingDeload };
}

function bestBwSet(session: LoggedSession): number {
  return Math.max(
    0,
    ...session.sets.filter((s) => !s.isWarmup && s.loadKg === 0).map((s) => s.actualReps)
  );
}

/** The set implying the highest e1RM — not simply the heaviest set. */
function bestWeightedSet(
  session: LoggedSession,
  bodyweightKg: number
): { loadKg: number; reps: number } | null {
  const working = session.sets.filter((s) => !s.isWarmup && s.actualReps > 0);
  if (working.length === 0) return null;
  let best = working[0];
  for (const s of working) {
    if (
      e1rmSystem(bodyweightKg, s.loadKg, s.actualReps) >
      e1rmSystem(bodyweightKg, best.loadKg, best.actualReps)
    ) {
      best = s;
    }
  }
  return { loadKg: best.loadKg, reps: best.actualReps };
}

export function applyResult(
  profile: Profile,
  prevState: ProgramState,
  session: LoggedSession,
  existingPrs: PR[]
): ApplyOutcome {
  const inc = profile.equipment.smallestPlateKg;
  let state: ProgramState = {
    ...prevState,
    weighted: { ...prevState.weighted },
    lastSessionDate: session.date,
  };
  const newPrs: PR[] = [];
  const newTests: TestPoint[] = [];
  const repsDone = session.sets.reduce((sum, s) => sum + s.actualReps, 0);
  const exempt = session.progressionExempt === true;

  const prBwReps = Math.max(0, ...existingPrs.filter((p) => p.kind === 'bwReps').map((p) => p.value));
  const prE1rm = Math.max(0, ...existingPrs.filter((p) => p.kind === 'e1rm').map((p) => p.value));

  const recordBwPr = (reps: number) => {
    if (reps > prBwReps && reps > 0) newPrs.push({ kind: 'bwReps', value: reps, date: session.date });
  };
  const recordE1rmPr = (e1rm: number) => {
    if (e1rm > prE1rm && e1rm > 0)
      newPrs.push({ kind: 'e1rm', value: Math.round(e1rm * 10) / 10, date: session.date });
  };

  switch (session.dayKind) {
    case 'calibration': {
      const best = bestWeightedSet(session, profile.bodyweightKg);
      if (best && best.loadKg > 0) {
        const e1rm = e1rmSystem(profile.bodyweightKg, best.loadKg, best.reps);
        state.e1rmKg = e1rm;
        // seed a load allowing ~7 clean reps → starts double progression with room to grow
        const working = Math.max(
          2.5,
          roundToIncrement(
            addedLoadForReps(e1rm, profile.bodyweightKg, C.CALIBRATION_TARGET_REPS + 1),
            2.5
          )
        );
        state.weighted = {
          ...state.weighted,
          loadKg: working,
          lastReps: [4, 4, 4, 4],
          sessionsAtLoad: 0,
        };
        recordE1rmPr(e1rm);
        newTests.push({ quality: 'weighted', value: e1rm, date: session.date });
      }
      state.calibrated = true;
      break;
    }
    case 'heavy': {
      // live e1RM from any weighted set (AMRAP last set usually) — runs even when exempt
      const liveBest = bestWeightedSet(session, profile.bodyweightKg);
      if (liveBest && liveBest.loadKg > 0) {
        const e1rm = e1rmSystem(profile.bodyweightKg, liveBest.loadKg, liveBest.reps);
        if (state.e1rmKg === null || e1rm > state.e1rmKg) state.e1rmKg = e1rm;
        recordE1rmPr(e1rm);
      }
      if (exempt) break;
      if (profile.equipment.mode === 'fixed') {
        applyFixedHeavy(profile, prevState, state, session);
        break;
      }
      const w = state.weighted;
      const working = session.sets.filter((s) => !s.isWarmup);
      const mainSets = working.filter((s) => s.loadKg >= w.loadKg - 0.01); // excludes back-off set
      const reps = mainSets.map((s) => s.actualReps);
      const grind = session.lastSetEffort === 'grind';
      const anyCollapse = reps.some((r) => r < C.REP_RANGE.bottom);
      const allTop = reps.length > 0 && reps.every((r) => r >= C.REP_RANGE.top);

      w.backoffNext = false;
      if (allTop && !grind) {
        // PASS → load up
        const step = w.microload || w.stallCount >= 1 ? inc : C.LOAD_INCREMENT_KG;
        w.loadKg = roundToIncrement(w.loadKg + step, inc);
        w.lastReps = Array(C.HEAVY_SETS).fill(C.REP_RANGE.bottom);
        w.sessionsAtLoad = 0;
        w.failStreak = 0;
      } else if (anyCollapse) {
        // FAIL
        w.failStreak += 1;
        if (reps[0] >= C.REP_RANGE.top) w.backoffNext = true; // strong start, late collapse
        if (w.failStreak >= C.FAILS_FOR_DELOAD) {
          state.pendingDeload = true;
          w.failStreak = 0;
          w.stallCount += 1;
        }
      } else {
        // HOLD — fill reps. Only sessions with NO rep progress count toward a stall.
        const prevTotal = prevState.weighted.lastReps.reduce((a, b) => a + b, 0);
        const nowTotal = reps.reduce((a, b) => a + Math.min(C.REP_RANGE.top, b), 0);
        w.lastReps = reps.map((r) =>
          Math.min(C.REP_RANGE.top, Math.max(C.REP_RANGE.bottom, r))
        );
        while (w.lastReps.length < C.HEAVY_SETS) w.lastReps.push(C.REP_RANGE.bottom);
        w.sessionsAtLoad = nowTotal > prevTotal ? 0 : w.sessionsAtLoad + 1;
        w.failStreak = 0;
        if (w.sessionsAtLoad >= C.SESSIONS_AT_LOAD_FOR_MICRO) {
          w.stallCount += 1;
          w.microload = true;
        }
      }
      w.grindStreak = grind ? w.grindStreak + 1 : 0;
      if (w.grindStreak >= C.GRINDS_FOR_DELOAD) {
        state.pendingDeload = true;
        w.grindStreak = 0;
      }
      break;
    }
    case 'custom': {
      // manual log: feeds every estimate, never advances the cycle
      const bestW = bestWeightedSet(session, profile.bodyweightKg);
      if (bestW && bestW.loadKg > 0) {
        const e1rm = e1rmSystem(profile.bodyweightKg, bestW.loadKg, bestW.reps);
        if (state.e1rmKg === null || e1rm > state.e1rmKg) state.e1rmKg = e1rm;
        recordE1rmPr(e1rm);
      }
      const bestBw = bestBwSet(session);
      if (bestBw > state.bwBestMaxSet) {
        state.bwBestMaxSet = bestBw;
        recordBwPr(bestBw);
      }
      return { state, newPrs, newTests, repsDone }; // no advance()
    }
    case 'volume':
    case 'deloadVolume':
    case 'deloadHeavy':
      break; // no state change — logged volume is its own reward
    case 'max': {
      const best = bestBwSet(session);
      if (best > 0) {
        state.bwBestMaxSet = best;
        recordBwPr(best);
      }
      break;
    }
    case 'ladder':
      break;
    case 'testBw': {
      const best = bestBwSet(session);
      if (best > 0) {
        state.bwBestMaxSet = best;
        state.bwLastTestReps = best;
        recordBwPr(best);
        newTests.push({ quality: 'bwReps', value: best, date: session.date });
      }
      break;
    }
    case 'testWeighted': {
      const best = bestWeightedSet(session, profile.bodyweightKg);
      if (best && best.loadKg > 0) {
        const e1rm = e1rmSystem(profile.bodyweightKg, best.loadKg, best.reps);
        state.e1rmKg = e1rm;
        recordE1rmPr(e1rm);
        newTests.push({ quality: 'weighted', value: e1rm, date: session.date });
        if (profile.equipment.mode === 'fixed') {
          // load is what it is — the test just recalibrates rep targets
          const range = fixedRepRange(profile, state);
          state.weighted = {
            ...state.weighted,
            lastReps: Array(state.weighted.setCount).fill(range.bottom),
            failStreak: 0,
            grindStreak: 0,
            backoffNext: false,
          };
          break;
        }
        // re-seed working load for the next block: a load allowing ~7 clean reps.
        // Never below the current working load — a test can only move you up.
        const working = Math.max(
          2.5,
          state.weighted.loadKg,
          roundToIncrement(addedLoadForReps(e1rm, profile.bodyweightKg, 7), inc)
        );
        state.weighted = {
          ...state.weighted,
          loadKg: working,
          lastReps: Array(C.HEAVY_SETS).fill(C.REP_RANGE.bottom),
          sessionsAtLoad: 0,
          failStreak: 0,
          grindStreak: 0,
          backoffNext: false,
        };
      }
      break;
    }
  }

  // Post-triggered-deload: resume slightly lighter (scheduled deloads keep load;
  // weighted tests re-seed it anyway).
  if (prevState.pendingDeload && session.dayKind === 'testBw') {
    state.weighted.loadKg = roundToIncrement(
      state.weighted.loadKg * C.POST_DELOAD_RESUME_FACTOR,
      inc
    );
    state.weighted.lastReps = Array(C.HEAVY_SETS).fill(C.REP_RANGE.bottom);
    state.weighted.sessionsAtLoad = 0;
  }

  state = advance(state);
  return { state, newPrs, newTests, repsDone };
}
