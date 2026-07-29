import { describe, expect, it } from 'vitest';
import { generateSession, initialState } from '../generator';
import { applyResult, replayAll } from '../stateMachine';
import { buildWhy, explainDetail, explainShort } from '../explain';
import * as C from '../constants';
import { LoggedSession, Profile, ProgramState, SetLog, VolumeTune } from '../types';
import { PULL_VARIATIONS } from '../pullVariations';

const profile: Profile = {
  bodyweightKg: 82,
  startingMax: 19, // volume base = ceil(19 * 0.5) = 10
  equipment: { mode: 'fixed', fixedLoadKg: 7.5, smallestPlateKg: 1.25 },
  trainingDays: [1, 3, 5],
  createdAt: '2026-07-20',
};

function volumeSession(
  reps: number[],
  opts?: { target?: number; rests?: Array<number | undefined>; planned?: number; exempt?: boolean; warmup?: boolean }
): LoggedSession {
  const target = opts?.target ?? 10;
  const planned = opts?.planned ?? 60;
  const sets: SetLog[] = reps.map((r, i) => ({
    targetReps: target,
    actualReps: r,
    loadKg: 0,
    restSecTaken: opts?.rests?.[i],
    restSecPlanned: i === reps.length - 1 ? 0 : planned,
  }));
  if (opts?.warmup) sets.unshift({ targetReps: 5, actualReps: 5, loadKg: 0, isWarmup: true });
  return {
    id: `v-1`,
    date: '2026-07-24',
    dayKind: 'volume',
    cycle: 1,
    week: 1,
    sets,
    progressionExempt: opts?.exempt,
  };
}

function stateWithTune(tune: Partial<VolumeTune>): ProgramState {
  const s = initialState(profile);
  return { ...s, volumeTune: { ...s.volumeTune, ...tune } };
}

const apply = (state: ProgramState, session: LoggedSession) =>
  applyResult(profile, state, session, []).state.volumeTune;

describe('volume tune metrics', () => {
  it('excludes warmups from completion and drop-off', () => {
    const t = apply(initialState(profile), volumeSession(Array(10).fill(10), { warmup: true }));
    expect(t.lastCompletionPct).toBe(1);
    expect(t.lastDropOff).toBe(1);
  });

  it('rest overage is the mean of taken/planned; null when no rest data', () => {
    const withData = apply(
      initialState(profile),
      volumeSession(Array(10).fill(10), { rests: Array(9).fill(90) })
    );
    expect(withData.lastRestOverage).toBeCloseTo(1.5, 5);
    const without = apply(initialState(profile), volumeSession(Array(10).fill(10)));
    expect(without.lastRestOverage).toBeNull();
  });
});

describe('volume tune rules (rest-first)', () => {
  it('crisp at baseline is a no-op with metrics stored', () => {
    const t = apply(initialState(profile), volumeSession(Array(10).fill(10)));
    expect(t.repAdj).toBe(0);
    expect(t.restSec).toBe(60);
    expect(t.lastOutcome).toBe('crisp');
  });

  it('moderate shortfall raises rest only', () => {
    // 10,10,10,10,9,9,9,9,9,8 → completion .93, dropOff .8
    const t = apply(initialState(profile), volumeSession([10, 10, 10, 10, 9, 9, 9, 9, 9, 8]));
    expect(t.restSec).toBe(75);
    expect(t.repAdj).toBe(0);
    expect(t.lastOutcome).toBe('moderate');
  });

  it('full completion with stretched rests is moderate (rest up, reps unchanged)', () => {
    const t = apply(
      initialState(profile),
      volumeSession(Array(10).fill(10), { rests: Array(9).fill(80) }) // overage 1.33
    );
    expect(t.restSec).toBe(75);
    expect(t.repAdj).toBe(0);
    expect(t.lastOutcome).toBe('moderate');
  });

  it("the real session — 10,10,10,10,8,8,8,8,6,6 — is a breakdown via drop-off", () => {
    const t = apply(initialState(profile), volumeSession([10, 10, 10, 10, 8, 8, 8, 8, 6, 6]));
    // completion .84 and dropOff .6 — both breakdown signals
    expect(t.lastOutcome).toBe('breakdown');
    expect(t.restSec).toBe(75);
    expect(t.repAdj).toBe(-1);
  });

  it('repeated breakdowns pin at rest 90 / repAdj -2', () => {
    let state = initialState(profile);
    for (let i = 0; i < 4; i++) {
      const out = applyResult(profile, state, volumeSession([10, 10, 6, 6, 5, 5, 5, 5, 4, 4]), []);
      state = out.state;
    }
    expect(state.volumeTune.restSec).toBe(90);
    expect(state.volumeTune.repAdj).toBe(-2);
  });

  it('crisp days walk back toward baseline — rest first, then reps, with a one-shot restored', () => {
    let state = stateWithTune({ restSec: 90, repAdj: -2 });
    const crispDay = () => volumeSession(Array(10).fill(9), { target: 9 });
    const seq: Array<[number, number, string]> = [
      [75, -2, 'crisp'],
      [60, -2, 'crisp'],
      [60, -1, 'crisp'],
      [60, 0, 'restored'],
      [60, 0, 'crisp'], // restored clears after the next counted day
    ];
    for (const [rest, adj, outcome] of seq) {
      state = applyResult(profile, state, crispDay(), []).state;
      expect([state.volumeTune.restSec, state.volumeTune.repAdj, state.volumeTune.lastOutcome]).toEqual([
        rest,
        adj,
        outcome,
      ]);
    }
  });
});

describe('volume tune guards', () => {
  it('exempt (rough/layoff) sessions never update the tune', () => {
    const before = stateWithTune({ restSec: 75, repAdj: -1, lastOutcome: 'breakdown' });
    const t = apply(before, volumeSession([3, 3, 3, 3, 3, 3, 3, 3], { exempt: true }));
    expect(t.restSec).toBe(75);
    expect(t.repAdj).toBe(-1);
    expect(t.lastOutcome).toBe('breakdown');
  });

  it('deload volume never updates the tune', () => {
    const before = stateWithTune({ restSec: 75, repAdj: -1 });
    const session: LoggedSession = { ...volumeSession([4, 4, 4]), dayKind: 'deloadVolume' };
    const t = applyResult(profile, before, session, []).state.volumeTune;
    expect(t.restSec).toBe(75);
    expect(t.repAdj).toBe(-1);
  });

  it('a bodyweight test resets the tune (new max = new baseline); max day does not', () => {
    const tuned = stateWithTune({ restSec: 90, repAdj: -2, lastOutcome: 'breakdown' });
    const test: LoggedSession = {
      id: 't', date: '2026-07-24', dayKind: 'testBw', cycle: 1, week: 4,
      sets: [{ targetReps: 20, actualReps: 21, loadKg: 0 }],
    };
    const afterTest = applyResult(profile, tuned, test, []).state.volumeTune;
    expect(afterTest).toEqual(C.defaultVolumeTune());

    const maxDay: LoggedSession = {
      id: 'm', date: '2026-07-24', dayKind: 'max', cycle: 1, week: 1,
      sets: [{ targetReps: 17, actualReps: 20, loadKg: 0 }],
    };
    const afterMax = applyResult(profile, tuned, maxDay, []).state.volumeTune;
    expect(afterMax.restSec).toBe(90);
    expect(afterMax.repAdj).toBe(-2);
  });

  it('does not mutate prevState.volumeTune', () => {
    const before = initialState(profile);
    const frozen = JSON.stringify(before.volumeTune);
    apply(before, volumeSession([10, 10, 10, 10, 8, 8, 8, 8, 6, 6]));
    expect(JSON.stringify(before.volumeTune)).toBe(frozen);
  });
});

describe('generator reads the tune', () => {
  it('tuned state changes reps, rests and headlines the adaptation', () => {
    const state = stateWithTune({
      restSec: 75,
      repAdj: -1,
      lastCompletionPct: 0.84,
      lastOutcome: 'breakdown',
    });
    // move to a volume slot
    const volState = { ...state, week: 1 as const, sessionInWeek: 2 as const };
    const plan = generateSession(profile, volState, '2026-07-26');
    expect(plan.dayKind).toBe('volume');
    const working = plan.sets.filter((s) => !s.isWarmup);
    // tuned base is ceil(19×.5) − 1 = 9, then scaled by each block's grip
    const scale = PULL_VARIATIONS.find((v) => v.key === working[0].variation!.key)!.scale;
    expect(working[0].targetReps).toBe(Math.max(2, Math.round(9 * scale)));
    expect(working[0].restSecAfter).toBe(75);
    expect(plan.decisions[0].code).toBe('VOLUME_ADAPTED');
    expect(plan.decisions[0].params.direction).toBe('easier');
    expect(plan.why).toContain('84');
  });

  it('an untuned day headlines the grip blocks, not an adaptation', () => {
    const state = { ...initialState(profile), week: 1 as const, sessionInWeek: 2 as const };
    const plan = generateSession(profile, state, '2026-07-26');
    expect(plan.decisions[0].code).toBe('VARIATION_BLOCKS');
    expect(plan.decisions.map((d) => d.code)).toContain('SUBMAX_DERIVED');
    expect(plan.decisions.map((d) => d.code)).not.toContain('VOLUME_ADAPTED');
    expect(plan.sets.filter((s) => !s.isWarmup)[0].restSecAfter).toBe(60);
  });

  it('restored fires the one-shot note at baseline', () => {
    const state = {
      ...stateWithTune({ lastOutcome: 'restored' }),
      week: 1 as const,
      sessionInWeek: 2 as const,
    };
    const plan = generateSession(profile, state, '2026-07-26');
    expect(plan.decisions[0].code).toBe('VOLUME_RESTORED');
  });

  it('rep floor holds at tiny maxes', () => {
    const small = {
      ...stateWithTune({ repAdj: -2 }),
      bwBestMaxSet: 5,
      week: 1 as const,
      sessionInWeek: 2 as const,
    };
    const plan = generateSession(profile, small, '2026-07-26');
    expect(plan.sets.filter((s) => !s.isWarmup)[0].targetReps).toBeGreaterThanOrEqual(3);
  });
});

describe('replay equivalence with tuned volume sessions', () => {
  it('replaying the log reproduces the incrementally-built tune', () => {
    let state = initialState(profile);
    const sessions: LoggedSession[] = [
      volumeSession([10, 10, 10, 10, 8, 8, 8, 8, 6, 6], {}),
      { ...volumeSession(Array(10).fill(9), { target: 9, rests: Array(9).fill(70), planned: 75 }), id: 'v-2', date: '2026-07-26' },
    ];
    for (const s of sessions) state = applyResult(profile, state, s, []).state;
    const replayed = replayAll(profile, sessions);
    expect(replayed.state.volumeTune).toEqual(state.volumeTune);
  });
});

describe('explain strings', () => {
  it('exist for both new codes and headline the why', () => {
    const adapted = {
      code: 'VOLUME_ADAPTED' as const,
      params: { completionPct: 84, restSec: 75, repAdj: -1, sets: 10, reps: 9, baseReps: 10, direction: 'easier' },
    };
    expect(explainShort(adapted).length).toBeGreaterThan(10);
    expect(explainDetail(adapted).length).toBeGreaterThan(10);
    const restored = { code: 'VOLUME_RESTORED' as const, params: { sets: 10, reps: 10, restSec: 60 } };
    expect(explainShort(restored).length).toBeGreaterThan(10);
    expect(explainDetail(restored).length).toBeGreaterThan(10);
    const why = buildWhy([adapted, { code: 'SUBMAX_DERIVED', params: { sets: 10, reps: 9, bestMax: 19 } }]);
    expect(why.why).toContain('84');
    expect(why.whyDetail).toContain('50');
  });
});
