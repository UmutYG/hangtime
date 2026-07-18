import {
  DayKind,
  Decision,
  PlannedSet,
  Profile,
  ProgramState,
  Readiness,
  SessionPlan,
} from './types';
import * as C from './constants';
import { buildWhy } from './explain';
import { roundToIncrement } from './epley';

export function initialState(profile: Profile): ProgramState {
  return {
    calibrated: false,
    cycle: 1,
    week: 1,
    sessionInWeek: 1,
    weighted: {
      loadKg: 0,
      lastReps: [4, 4, 4, 4],
      failStreak: 0,
      grindStreak: 0,
      stallCount: 0,
      sessionsAtLoad: 0,
      microload: false,
      backoffNext: false,
    },
    bwBestMaxSet: profile.startingMax,
    bwLastTestReps: profile.startingMax,
    e1rmKg: null,
    pendingDeload: false,
    lastSessionDate: null,
  };
}

export function resolveDayKind(state: ProgramState): DayKind {
  if (!state.calibrated) return 'calibration';
  const deloadWeek = state.week === 4 || state.pendingDeload;
  if (deloadWeek) {
    if (state.sessionInWeek === 1) return 'deloadHeavy';
    if (state.sessionInWeek === 2) return 'deloadVolume';
    return state.cycle % 2 === 1 ? 'testBw' : 'testWeighted';
  }
  if (state.sessionInWeek === 1) return 'heavy';
  if (state.sessionInWeek === 2) return 'volume';
  return state.week === 2 ? 'ladder' : 'max';
}

const TITLES: Record<DayKind, string> = {
  calibration: 'Calibration — find your load',
  heavy: 'Heavy Day — weighted pull-ups',
  volume: 'Volume Day — sub-max sets',
  max: 'Max Day — all-out sets',
  ladder: 'Ladder Day',
  deloadHeavy: 'Deload — light weighted',
  deloadVolume: 'Deload — easy volume',
  testBw: 'TEST — bodyweight max reps',
  testWeighted: 'TEST — weighted 5RM',
};

function warmupForLoad(loadKg: number, inc: number): PlannedSet[] {
  const w: PlannedSet[] = [
    { targetReps: 5, loadKg: 0, isWarmup: true, restSecAfter: 60 },
    { targetReps: 3, loadKg: 0, isWarmup: true, restSecAfter: 60 },
  ];
  if (loadKg >= 10) {
    w.push({ targetReps: 3, loadKg: roundToIncrement(loadKg * 0.5, inc), isWarmup: true, restSecAfter: 90 });
  }
  if (loadKg >= 5) {
    w.push({ targetReps: 2, loadKg: roundToIncrement(loadKg * 0.8, inc), isWarmup: true, restSecAfter: 120 });
  }
  return w;
}

function daysBetween(a: string, b: string): number {
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
}

export function generateSession(
  profile: Profile,
  state: ProgramState,
  today: string,
  readiness?: Readiness
): SessionPlan {
  const inc = profile.smallestPlateKg;
  const dayKind = resolveDayKind(state);
  const decisions: Decision[] = [];
  let sets: PlannedSet[] = [];
  let progressionExempt = false;

  const layoffDays =
    state.lastSessionDate !== null ? daysBetween(state.lastSessionDate, today) : 0;
  const layoff = layoffDays >= C.LAYOFF_DAYS && state.calibrated;
  const rough = readiness === 'rough';
  if (layoff || rough) progressionExempt = true;

  const w = state.weighted;
  const loadFactor = layoff ? C.LAYOFF_LOAD_FACTOR : 1;

  switch (dayKind) {
    case 'calibration': {
      decisions.push({ code: 'CALIBRATION', params: {} });
      const startLoad = Math.max(2.5, roundToIncrement(profile.bodyweightKg * 0.06, 2.5));
      sets = [
        { targetReps: 5, loadKg: 0, isWarmup: true, restSecAfter: 90 },
        { targetReps: 3, loadKg: 0, isWarmup: true, restSecAfter: 90 },
        { targetReps: 3, loadKg: startLoad, restSecAfter: 150, note: 'Feels easy? Add weight next set.' },
        { targetReps: 3, loadKg: startLoad + 5, restSecAfter: 150, note: 'Keep adding 2.5–5 kg while form stays crisp.' },
        { targetReps: 3, loadKg: startLoad + 10, restSecAfter: 180, note: 'Stop climbing at ~8/10 effort. Adjust load as needed.' },
        { targetReps: 5, loadKg: startLoad + 10, amrap: true, restSecAfter: 0, note: 'Top set: as many clean reps as you have. Log the real load you used.' },
      ];
      break;
    }
    case 'heavy': {
      const load = roundToIncrement(w.loadKg * loadFactor, inc);
      // Per-set targets carry over from last time at this load (double progression fills reps).
      const nSets = rough ? C.HEAVY_SETS - 1 : C.HEAVY_SETS;
      const targets = w.lastReps.slice(0, nSets);
      while (targets.length < nSets) targets.push(C.REP_RANGE.bottom);
      sets = [
        ...warmupForLoad(load, inc),
        ...targets.map((t, i): PlannedSet => {
          const last = i === nSets - 1;
          if (last && w.backoffNext) {
            return {
              targetReps: C.REP_RANGE.bottom,
              loadKg: roundToIncrement(load * 0.9, inc),
              amrap: true,
              amrapCap: C.HEAVY_AMRAP_CAP,
              restSecAfter: 0,
              note: 'Back-off set: −10 %, max clean reps.',
            };
          }
          return {
            targetReps: t,
            loadKg: load,
            amrap: last,
            amrapCap: last ? C.HEAVY_AMRAP_CAP : undefined,
            restSecAfter: last ? 0 : C.HEAVY_REST_SEC,
            note: last ? 'Last set: go for extra reps, cap at 8, keep 1 in reserve.' : undefined,
          };
        }),
      ];
      // Primary decision reflects how we got here
      if (w.backoffNext) decisions.push({ code: 'BACKOFF_SET', params: { load } });
      else if (w.failStreak > 0) decisions.push({ code: 'REPEAT_AFTER_FAIL', params: { load } });
      else if (w.sessionsAtLoad === 0 && state.e1rmKg !== null) {
        const code = w.microload ? 'LOAD_UP_MICRO' : 'LOAD_UP';
        decisions.push({
          code,
          params: {
            prevLoad: w.loadKg - (w.microload ? inc : C.LOAD_INCREMENT_KG),
            increment: w.microload ? inc : C.LOAD_INCREMENT_KG,
            reps: '6/6/6/6',
          },
        });
      } else decisions.push({ code: 'HOLD_FILL_REPS', params: { load } });
      break;
    }
    case 'volume': {
      const reps = Math.max(3, Math.ceil(state.bwBestMaxSet * C.VOLUME_PCT_OF_MAX));
      const n = rough ? C.VOLUME_SETS_ROUGH : C.VOLUME_SETS;
      decisions.push({
        code: 'SUBMAX_DERIVED',
        params: { sets: n, reps, bestMax: state.bwBestMaxSet },
      });
      sets = Array.from({ length: n }, (_, i) => ({
        targetReps: reps,
        loadKg: 0,
        restSecAfter: i === n - 1 ? 0 : C.VOLUME_REST_SEC,
      }));
      break;
    }
    case 'max': {
      decisions.push({ code: 'MAX_DAY', params: {} });
      sets = [
        { targetReps: 3, loadKg: 0, isWarmup: true, restSecAfter: 120 },
        ...Array.from({ length: C.MAX_DAY_SETS }, (_, i) => ({
          targetReps: Math.max(1, state.bwBestMaxSet - 2),
          loadKg: 0,
          amrap: true,
          restSecAfter: i === C.MAX_DAY_SETS - 1 ? 0 : C.MAX_DAY_REST_SEC,
          note: 'All-out, but stop when form breaks.',
        })),
      ];
      break;
    }
    case 'ladder': {
      const top = C.LADDER_TOP_RUNG(state.bwBestMaxSet);
      const ladders = rough ? C.LADDER_COUNT - 1 : C.LADDER_COUNT;
      decisions.push({ code: 'LADDER_DAY', params: { topRung: top } });
      for (let l = 0; l < ladders; l++) {
        for (let r = 1; r <= top; r++) {
          sets.push({
            targetReps: r,
            loadKg: 0,
            ladder: { ladderIndex: l + 1, rung: r },
            restSecAfter:
              r === top ? (l === ladders - 1 ? 0 : C.LADDER_REST_SEC) : C.LADDER_RUNG_REST_SEC,
          });
        }
      }
      break;
    }
    case 'deloadHeavy': {
      decisions.push({
        code: state.pendingDeload ? 'DELOAD_TRIGGERED' : 'DELOAD_SCHEDULED',
        params: {},
      });
      const load = roundToIncrement(w.loadKg * C.DELOAD_LOAD_FACTOR, inc);
      sets = [
        ...warmupForLoad(load, inc),
        ...Array.from({ length: C.DELOAD_HEAVY_SETS }, (_, i) => ({
          targetReps: C.DELOAD_HEAVY_REPS,
          loadKg: load,
          restSecAfter: i === C.DELOAD_HEAVY_SETS - 1 ? 0 : C.HEAVY_REST_SEC,
        })),
      ];
      progressionExempt = true;
      break;
    }
    case 'deloadVolume': {
      decisions.push({
        code: state.pendingDeload ? 'DELOAD_TRIGGERED' : 'DELOAD_SCHEDULED',
        params: {},
      });
      const reps = Math.max(3, Math.ceil(state.bwBestMaxSet * C.VOLUME_PCT_OF_MAX * 0.8));
      sets = Array.from({ length: C.DELOAD_VOLUME_SETS }, (_, i) => ({
        targetReps: reps,
        loadKg: 0,
        restSecAfter: i === C.DELOAD_VOLUME_SETS - 1 ? 0 : C.VOLUME_REST_SEC,
      }));
      progressionExempt = true;
      break;
    }
    case 'testBw': {
      decisions.push({ code: 'TEST_BW', params: {} });
      sets = [
        { targetReps: 5, loadKg: 0, isWarmup: true, restSecAfter: 120 },
        { targetReps: 3, loadKg: 0, isWarmup: true, restSecAfter: 180 },
        {
          targetReps: state.bwLastTestReps + 1,
          loadKg: 0,
          amrap: true,
          restSecAfter: 0,
          note: 'One set. Everything you have, strict form.',
        },
      ];
      break;
    }
    case 'testWeighted': {
      decisions.push({ code: 'TEST_WEIGHTED', params: {} });
      const load = roundToIncrement(w.loadKg, inc);
      sets = [
        ...warmupForLoad(Math.max(load, 5), inc),
        { targetReps: 3, loadKg: load, restSecAfter: 180, note: 'Builder set.' },
        {
          targetReps: 5,
          loadKg: load + C.LOAD_INCREMENT_KG,
          amrap: true,
          amrapCap: 8,
          restSecAfter: 0,
          note: 'Top set of 5 — adjust load so 5 is genuinely hard. Log the real load.',
        },
      ];
      break;
    }
  }

  if (layoff) decisions.push({ code: 'LAYOFF_RAMP', params: { days: layoffDays } });
  if (rough) decisions.push({ code: 'READINESS_TRIM', params: {} });

  const { why, whyDetail } = buildWhy(decisions);
  return {
    dayKind,
    cycle: state.cycle,
    week: state.week,
    sessionInWeek: state.sessionInWeek,
    title: TITLES[dayKind],
    sets,
    decisions,
    why,
    whyDetail,
    progressionExempt,
  };
}
