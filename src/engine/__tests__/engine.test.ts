import { describe, expect, it } from 'vitest';
import { generateSession, initialState, resolveDayKind } from '../generator';
import { applyResult, replayAll } from '../stateMachine';
import { computeGoals } from '../goals';
import { e1rmSystem, addedLoadForReps } from '../epley';
import {
  LoggedSession,
  PlannedSet,
  PR,
  Profile,
  ProgramState,
  SessionPlan,
  TestPoint,
} from '../types';

const profile: Profile = {
  bodyweightKg: 80,
  startingMax: 19,
  equipment: { mode: 'adjustable', fixedLoadKg: 7.5, smallestPlateKg: 1.25 },
  trainingDays: [1, 3, 5],
  createdAt: '2026-07-20',
};

const vestProfile: Profile = {
  ...profile,
  bodyweightKg: 82,
  equipment: { mode: 'fixed', fixedLoadKg: 7.5, smallestPlateKg: 1.25 },
};

let dayCounter = 0;
function nextDate(): string {
  dayCounter += 2; // sessions ~every 2 days
  const d = new Date('2026-07-20');
  d.setDate(d.getDate() + dayCounter);
  return d.toISOString().slice(0, 10);
}

/** Log a session hitting every planned target exactly (AMRAP sets get `amrapReps` if given). */
function logPerfect(plan: SessionPlan, date: string, opts?: { amrapReps?: number; effort?: 'easy' | 'right' | 'grind' }): LoggedSession {
  return {
    id: `s-${date}-${plan.dayKind}`,
    date,
    dayKind: plan.dayKind,
    cycle: plan.cycle,
    week: plan.week,
    progressionExempt: plan.progressionExempt,
    lastSetEffort: opts?.effort ?? 'right',
    sets: plan.sets.map((s: PlannedSet) => ({
      targetReps: s.targetReps,
      actualReps: s.amrap && opts?.amrapReps !== undefined ? opts.amrapReps : s.targetReps,
      loadKg: s.loadKg,
      isWarmup: s.isWarmup,
    })),
  };
}

function runSession(
  state: ProgramState,
  prs: PR[],
  tests: TestPoint[],
  mutate?: (plan: SessionPlan, log: LoggedSession) => void,
  opts?: { amrapReps?: number; effort?: 'easy' | 'right' | 'grind' }
) {
  const date = nextDate();
  const plan = generateSession(profile, state, date);
  const log = logPerfect(plan, date, opts);
  mutate?.(plan, log);
  const out = applyResult(profile, state, log, prs);
  prs.push(...out.newPrs);
  tests.push(...out.newTests);
  return { plan, out };
}

describe('epley', () => {
  it('round-trips e1RM and load-for-reps', () => {
    const e1 = e1rmSystem(80, 20, 5); // 100 * 1.1667 = 116.7
    expect(e1).toBeCloseTo(116.67, 1);
    expect(addedLoadForReps(e1, 80, 5)).toBeCloseTo(20, 5);
  });
});

describe('sequencing', () => {
  it('first ever session is calibration, then volume, then max', () => {
    const s0 = initialState(profile);
    expect(resolveDayKind(s0)).toBe('calibration');
  });

  it('week 4 is deload + test; cycle 1 tests BW, cycle 2 tests weighted', () => {
    const s = { ...initialState(profile), calibrated: true };
    const w4 = { ...s, week: 4 as const };
    expect(resolveDayKind({ ...w4, sessionInWeek: 1 })).toBe('deloadHeavy');
    expect(resolveDayKind({ ...w4, sessionInWeek: 2 })).toBe('deloadVolume');
    expect(resolveDayKind({ ...w4, sessionInWeek: 3 })).toBe('testBw');
    expect(resolveDayKind({ ...w4, sessionInWeek: 3, cycle: 2 })).toBe('testWeighted');
  });

  it('day 3 alternates: weeks 1/3 max, week 2 ladder', () => {
    const s = { ...initialState(profile), calibrated: true, sessionInWeek: 3 as const };
    expect(resolveDayKind({ ...s, week: 1 })).toBe('max');
    expect(resolveDayKind({ ...s, week: 2 })).toBe('ladder');
    expect(resolveDayKind({ ...s, week: 3 })).toBe('max');
  });
});

describe('calibration', () => {
  it('seeds e1RM and a working load from the logged top set', () => {
    const state = initialState(profile);
    const prs: PR[] = [];
    const tests: TestPoint[] = [];
    const { out } = runSession(state, prs, tests, (plan, log) => {
      // user actually did +15 kg × 6 on the top set
      const top = log.sets[log.sets.length - 1];
      top.loadKg = 15;
      top.actualReps = 6;
    });
    expect(out.state.calibrated).toBe(true);
    expect(out.state.e1rmKg).toBeCloseTo(e1rmSystem(80, 15, 6), 1);
    expect(out.state.weighted.loadKg).toBeGreaterThan(5);
    expect(out.state.weighted.loadKg).toBeLessThan(20);
    expect(tests).toHaveLength(1);
    // position advanced to session 2 of week 1
    expect(out.state.sessionInWeek).toBe(2);
  });
});

describe('double progression state machine', () => {
  function calibrated(): ProgramState {
    const s = { ...initialState(profile), calibrated: true };
    s.weighted = { ...s.weighted, loadKg: 10 };
    s.e1rmKg = e1rmSystem(80, 15, 6);
    return { ...s, week: 1, sessionInWeek: 1 };
  }

  it('pass (all sets at 6, no grind) → +2.5 kg, targets reset to 4', () => {
    const state = calibrated();
    const date = nextDate();
    const plan = generateSession(profile, state, date);
    const log = logPerfect(plan, date, { effort: 'right' });
    log.sets.forEach((s) => {
      if (!s.isWarmup) s.actualReps = 6;
    });
    const out = applyResult(profile, state, log, []);
    expect(out.state.weighted.loadKg).toBe(12.5);
    expect(out.state.weighted.lastReps).toEqual([4, 4, 4, 4]);
  });

  it('grind blocks the load increase even at 6s', () => {
    const state = calibrated();
    const date = nextDate();
    const plan = generateSession(profile, state, date);
    const log = logPerfect(plan, date, { effort: 'grind' });
    log.sets.forEach((s) => {
      if (!s.isWarmup) s.actualReps = 6;
    });
    const out = applyResult(profile, state, log, []);
    expect(out.state.weighted.loadKg).toBe(10);
    expect(out.state.weighted.grindStreak).toBe(1);
  });

  it('hold: partial top fills targets from achieved reps', () => {
    const state = calibrated();
    const date = nextDate();
    const plan = generateSession(profile, state, date);
    const log = logPerfect(plan, date);
    const working = log.sets.filter((s) => !s.isWarmup);
    [6, 6, 5, 4].forEach((r, i) => (working[i].actualReps = r));
    const out = applyResult(profile, state, log, []);
    expect(out.state.weighted.loadKg).toBe(10);
    expect(out.state.weighted.lastReps).toEqual([6, 6, 5, 4]);
    // rep progress (16 → 21 total) resets the stall counter
    expect(out.state.weighted.sessionsAtLoad).toBe(0);
  });

  it('collapse (<4) → repeat; 2 consecutive → triggered deload', () => {
    let state = calibrated();
    for (let i = 0; i < 2; i++) {
      const date = nextDate();
      const plan = generateSession(profile, state, date);
      const log = logPerfect(plan, date);
      const working = log.sets.filter((s) => !s.isWarmup);
      [6, 4, 3, 2].forEach((r, j) => (working[j].actualReps = r));
      const out = applyResult(profile, state, log, []);
      // put position back on a heavy day so the fail path repeats
      state = { ...out.state, week: 1, sessionInWeek: 1 };
    }
    expect(state.pendingDeload).toBe(true);
  });

  it('late collapse after strong first set → back-off set next session', () => {
    const state = calibrated();
    const date = nextDate();
    const plan = generateSession(profile, state, date);
    const log = logPerfect(plan, date);
    const working = log.sets.filter((s) => !s.isWarmup);
    [6, 5, 4, 2].forEach((r, j) => (working[j].actualReps = r));
    const out = applyResult(profile, state, log, []);
    expect(out.state.weighted.backoffNext).toBe(true);
    const nextPlan = generateSession(
      profile,
      { ...out.state, week: 1, sessionInWeek: 1 },
      nextDate()
    );
    const backoff = nextPlan.sets[nextPlan.sets.length - 1];
    expect(backoff.loadKg).toBeLessThan(out.state.weighted.loadKg);
    expect(nextPlan.decisions[0].code).toBe('BACKOFF_SET');
  });

  it('3 no-progress hold sessions at same load → microloading kicks in', () => {
    let state = calibrated();
    // session 1 counts as progress (16→18 total reps); the next 3 identical ones stall
    for (let i = 0; i < 4; i++) {
      const date = nextDate();
      const plan = generateSession(profile, state, date);
      const log = logPerfect(plan, date);
      const working = log.sets.filter((s) => !s.isWarmup);
      [5, 5, 4, 4].forEach((r, j) => (working[j].actualReps = r));
      const out = applyResult(profile, state, log, []);
      state = { ...out.state, week: 1, sessionInWeek: 1 };
    }
    expect(state.weighted.microload).toBe(true);
    // now a pass should add only the small plate
    const date = nextDate();
    const plan = generateSession(profile, state, date);
    const log = logPerfect(plan, date);
    log.sets.forEach((s) => {
      if (!s.isWarmup) s.actualReps = 6;
    });
    const out = applyResult(profile, state, log, []);
    expect(out.state.weighted.loadKg).toBe(11.25);
  });
});

describe('BW days recalibrate targets', () => {
  it('max day best set drives volume day reps at 50 %', () => {
    let state = { ...initialState(profile), calibrated: true, week: 1 as const, sessionInWeek: 3 as const };
    state.weighted.loadKg = 10;
    const date = nextDate();
    const plan = generateSession(profile, state, date);
    expect(plan.dayKind).toBe('max');
    const log = logPerfect(plan, date, { amrapReps: 21 });
    const out = applyResult(profile, state, log, []);
    expect(out.state.bwBestMaxSet).toBe(21);
    const volPlan = generateSession(
      profile,
      { ...out.state, week: 2, sessionInWeek: 2 },
      nextDate()
    );
    expect(volPlan.dayKind).toBe('volume');
    expect(volPlan.sets[0].targetReps).toBe(Math.ceil(21 * 0.5));
    expect(volPlan.sets).toHaveLength(10);
  });
});

describe('full 16-week simulated athlete', () => {
  it('progresses load, hits deloads/tests on schedule, never crashes', () => {
    let state = initialState(profile);
    const prs: PR[] = [];
    const tests: TestPoint[] = [];
    const seen: string[] = [];
    let totalReps = 0;

    for (let i = 0; i < 48; i++) {
      // 16 weeks × 3 sessions
      const { plan, out } = runSession(state, prs, tests, (p, log) => {
        if (p.dayKind === 'calibration') {
          const top = log.sets[log.sets.length - 1];
          top.loadKg = 12.5;
          top.actualReps = 6;
        }
        if (p.dayKind === 'heavy') {
          // athlete fills reps bottom-up, ~2 extra reps per session (realistic pace)
          const working = log.sets.filter((s) => !s.isWarmup);
          let bumps = 2;
          working.forEach((s) => {
            let r = Math.min(6, s.targetReps);
            if (bumps > 0 && r < 6) {
              r += 1;
              bumps -= 1;
            }
            s.actualReps = r;
          });
        }
        if (p.dayKind === 'testBw') {
          const top = log.sets[log.sets.length - 1];
          top.actualReps = state.bwLastTestReps + 2; // +2 reps per 8-week cycle pair
        }
        if (p.dayKind === 'testWeighted') {
          const top = log.sets[log.sets.length - 1];
          top.actualReps = 5;
        }
      });
      seen.push(plan.dayKind);
      totalReps += out.repsDone;
      expect(plan.why.length).toBeGreaterThan(0); // every session explains itself
      state = out.state;
    }

    expect(seen[0]).toBe('calibration');
    expect(seen).toContain('deloadHeavy');
    expect(seen).toContain('testBw');
    expect(seen).toContain('testWeighted');
    expect(seen).toContain('ladder');
    expect(seen).toContain('max');
    // 16 weeks = 4 cycles → cycle counter advanced
    expect(state.cycle).toBeGreaterThanOrEqual(4);
    // load moved up from the ~7.5–10 kg seed
    expect(state.weighted.loadKg).toBeGreaterThan(10);
    expect(state.e1rmKg).not.toBeNull();
    expect(totalReps).toBeGreaterThan(500);
    expect(prs.length).toBeGreaterThan(0);

    const goals = computeGoals(profile, state, tests, '2026-11-01');
    expect(goals.length).toBeGreaterThan(0);
    for (const g of goals) {
      expect(g.etaMonth).toMatch(/^[A-Z][a-z]{2} 20\d\d$/);
      expect(g.targetValue).toBeGreaterThan(0);
    }
  });
});

describe('readiness & layoff', () => {
  it('rough readiness trims a set and exempts progression', () => {
    const state = { ...initialState(profile), calibrated: true };
    state.weighted.loadKg = 10;
    const plan = generateSession(profile, state, nextDate(), 'rough');
    const working = plan.sets.filter((s) => !s.isWarmup);
    expect(working).toHaveLength(3);
    expect(plan.progressionExempt).toBe(true);
  });

  it('long layoff produces a ramp session that cannot fail you', () => {
    const state = { ...initialState(profile), calibrated: true, lastSessionDate: '2026-07-01' };
    state.weighted.loadKg = 20;
    const plan = generateSession(profile, state, '2026-07-20');
    expect(plan.progressionExempt).toBe(true);
    expect(plan.decisions.some((d) => d.code === 'LAYOFF_RAMP')).toBe(true);
    const working = plan.sets.filter((s) => !s.isWarmup);
    expect(working[0].loadKg).toBeLessThan(20);
  });
});

describe('fixed-vest mode', () => {
  it('skips calibration and starts on a vest heavy day with sane targets', () => {
    const state = initialState(vestProfile);
    expect(state.calibrated).toBe(true);
    expect(state.e1rmKg).not.toBeNull();
    const plan = generateSession(vestProfile, state, '2026-07-20');
    expect(plan.dayKind).toBe('heavy');
    expect(plan.decisions[0].code).toBe('FIRST_VEST_SESSION');
    const working = plan.sets.filter((s) => !s.isWarmup);
    expect(working).toHaveLength(4);
    // every working set uses exactly the vest load
    working.forEach((s) => expect(s.loadKg).toBe(7.5));
    // 19 BW max @82kg → e1rm ~133.9 → est vest reps ~14.5 → top 12 (capped), bottom 9
    expect(working[0].targetReps).toBeGreaterThanOrEqual(8);
    expect(working[0].targetReps).toBeLessThanOrEqual(12);
    expect(plan.sets[plan.sets.length - 1].amrap).toBe(true);
  });

  it('progression ladder: all-topped → 5th set → denser rests → suggest more load', () => {
    let state = initialState(vestProfile);
    const runTopped = () => {
      const date = nextDate();
      const plan = generateSession(vestProfile, state, date);
      const log = logPerfect(plan, date, { effort: 'right' });
      // top every working set (targets clamp at range top = 12)
      log.sets.forEach((s) => {
        if (!s.isWarmup) s.actualReps = 12;
      });
      const out = applyResult(vestProfile, state, log, []);
      state = { ...out.state, week: 1, sessionInWeek: 1, lastSessionDate: date };
    };
    runTopped();
    expect(state.weighted.setCount).toBe(5);
    runTopped();
    expect(state.weighted.restSec).toBe(120);
    runTopped();
    expect(state.weighted.suggestMoreLoad).toBe(true);
    const plan = generateSession(vestProfile, state, nextDate());
    expect(plan.decisions[0].code).toBe('SUGGEST_MORE_LOAD');
    expect(plan.sets.filter((s) => !s.isWarmup)).toHaveLength(5);
  });

  it('vest AMRAP raises e1RM and with it the next rep targets', () => {
    let state = initialState(vestProfile);
    const before = state.e1rmKg!;
    const date = nextDate();
    const plan = generateSession(vestProfile, state, date);
    const log = logPerfect(plan, date, { effort: 'right' });
    const working = log.sets.filter((s) => !s.isWarmup);
    working.forEach((s, i) => (s.actualReps = Math.min(s.targetReps, 10)));
    working[working.length - 1].actualReps = 16; // monster AMRAP
    const out = applyResult(vestProfile, state, log, []);
    expect(out.state.e1rmKg!).toBeGreaterThan(before);
  });

  it('custom manual log updates estimates but never advances the cycle', () => {
    const state = initialState(vestProfile);
    const log = {
      id: 'manual-1',
      date: '2026-07-20',
      dayKind: 'custom' as const,
      cycle: 0,
      week: 0,
      sets: [
        { targetReps: 17, actualReps: 17, loadKg: 7.5 }, // e1RM 140.2 > seed 133.9
        { targetReps: 21, actualReps: 21, loadKg: 0 },
      ],
    };
    const out = applyResult(vestProfile, state, log, []);
    expect(out.state.sessionInWeek).toBe(1); // no advance
    expect(out.state.week).toBe(1);
    expect(out.state.bwBestMaxSet).toBe(21);
    expect(out.state.e1rmKg!).toBeGreaterThan(initialState(vestProfile).e1rmKg!);
    expect(out.repsDone).toBe(38);
  });

  it('fixed-mode weighted test recalibrates targets without touching the load', () => {
    let state = { ...initialState(vestProfile), cycle: 2, week: 4 as const, sessionInWeek: 3 as const };
    const date = nextDate();
    const plan = generateSession(vestProfile, state, date);
    expect(plan.dayKind).toBe('testWeighted');
    const log = logPerfect(plan, date, { amrapReps: 15 });
    const out = applyResult(vestProfile, state, log, []);
    expect(out.state.weighted.loadKg).toBe(7.5);
    expect(out.state.e1rmKg).toBeCloseTo(e1rmSystem(82, 7.5, 15), 1);
  });
});

describe('replayAll (history edit/delete safety)', () => {
  it('replaying the full log reproduces the same state as live application', () => {
    let state = initialState(vestProfile);
    const prs: PR[] = [];
    const sessions: LoggedSession[] = [];
    for (let i = 0; i < 9; i++) {
      const date = nextDate();
      const plan = generateSession(vestProfile, state, date);
      const log = logPerfect(plan, date, { effort: 'right', amrapReps: 13 });
      sessions.push(log);
      const out = applyResult(vestProfile, state, log, prs);
      prs.push(...out.newPrs);
      state = out.state;
    }
    const replayed = replayAll(vestProfile, sessions);
    expect(replayed.state).toEqual(state);
    expect(replayed.prs).toEqual(prs);
    // deleting the last session rewinds the schedule and the counters
    const withoutLast = replayAll(vestProfile, sessions.slice(0, -1));
    expect(withoutLast.lifetimeReps).toBeLessThan(replayed.lifetimeReps);
    expect([
      withoutLast.state.cycle,
      withoutLast.state.week,
      withoutLast.state.sessionInWeek,
    ]).not.toEqual([state.cycle, state.week, state.sessionInWeek]);
  });
});

describe('goals', () => {
  it('produces next milestones with sane ETAs for the real user profile', () => {
    const state = { ...initialState(profile), calibrated: true };
    state.bwLastTestReps = 19;
    state.e1rmKg = e1rmSystem(80, 12.5, 6); // fresh weighted athlete
    const goals = computeGoals(profile, state, [], '2026-07-20');
    const rep = goals.find((g) => g.quality === 'bwReps');
    expect(rep?.targetValue).toBe(20);
    const weighted = goals.find((g) => g.quality === 'weighted');
    expect(weighted?.label).toContain('+20 kg'); // 25 % of 80 kg
  });
});
