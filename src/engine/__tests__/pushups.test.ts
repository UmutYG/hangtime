import { describe, expect, it } from 'vitest';
import {
  applyPushResult,
  computePushGoal,
  generatePushSession,
  initialPushState,
  replayPushAll,
  pushVariationFor,
  resolvePushDayKind,
} from '../pushups';
import { LoggedSession, PR, PushState, SessionPlan } from '../types';

function logged(plan: SessionPlan, date: string, amrapReps?: number): LoggedSession {
  return {
    id: `${date}-${plan.dayKind}`,
    date,
    dayKind: plan.dayKind,
    cycle: plan.cycle,
    week: plan.week,
    progressionExempt: plan.progressionExempt,
    sets: plan.sets.map((s) => ({
      targetReps: s.targetReps,
      actualReps: s.amrap && amrapReps !== undefined ? amrapReps : s.targetReps,
      loadKg: 0,
      isWarmup: s.isWarmup,
    })),
  };
}

describe('push sequencing', () => {
  it('weeks 1-3: pyramid / volume / max-or-ladder; week 4: deload deload test', () => {
    const s = initialPushState(35);
    expect(resolvePushDayKind({ ...s, week: 1, sessionInWeek: 1 })).toBe('pushPyramid');
    expect(resolvePushDayKind({ ...s, week: 1, sessionInWeek: 2 })).toBe('pushVolume');
    expect(resolvePushDayKind({ ...s, week: 1, sessionInWeek: 3 })).toBe('pushMax');
    expect(resolvePushDayKind({ ...s, week: 2, sessionInWeek: 3 })).toBe('pushLadder');
    expect(resolvePushDayKind({ ...s, week: 4, sessionInWeek: 1 })).toBe('pushDeload');
    expect(resolvePushDayKind({ ...s, week: 4, sessionInWeek: 3 })).toBe('pushTest');
  });
});

describe('push session shapes derive from the max', () => {
  const state = initialPushState(40);

  it('pyramid: Speirs fractions + all-out finisher', () => {
    const plan = generatePushSession(state);
    expect(plan.dayKind).toBe('pushPyramid');
    expect(plan.sets.map((s) => s.targetReps)).toEqual([20, 24, 20, 16, 24]);
    expect(plan.sets[plan.sets.length - 1].amrap).toBe(true);
    expect(plan.why.length).toBeGreaterThan(0);
  });

  it('volume: 10 sets at 50 % of max, scaled for the rotating variation', () => {
    const s = { ...state, sessionInWeek: 2 as const };
    const plan = generatePushSession(s);
    const v = pushVariationFor(s);
    expect(plan.sets).toHaveLength(10);
    expect(plan.sets[0].targetReps).toBe(Math.max(3, Math.ceil(40 * 0.5 * v.scale)));
    expect(plan.sets[0].note).toContain(v.name);
    expect(plan.why).toContain(v.name.toLowerCase());
  });

  it('variation rotation is deterministic and skips standard', () => {
    const s = { ...state, sessionInWeek: 2 as const };
    expect(pushVariationFor(s).key).toBe(pushVariationFor(s).key);
    expect(pushVariationFor(s).key).not.toBe('standard');
    // ladder day: each ladder gets its own variation
    const ladderPlan = generatePushSession({ ...state, week: 2, sessionInWeek: 3 });
    const firstRungNotes = ladderPlan.sets.filter((x) => x.ladder?.rung === 1).map((x) => x.note);
    expect(new Set(firstRungNotes).size).toBe(firstRungNotes.length); // all different
  });

  it('test day asks for last test + 2 as AMRAP', () => {
    const plan = generatePushSession({ ...state, week: 4, sessionInWeek: 3 });
    const top = plan.sets[plan.sets.length - 1];
    expect(top.amrap).toBe(true);
    expect(top.targetReps).toBe(42);
  });
});

describe('push apply/replay', () => {
  it('max day raises bestMax and mints a PR; test overwrites; cycle advances', () => {
    let state = initialPushState(35);
    const prs: PR[] = [];
    // jump to max day
    state = { ...state, week: 1, sessionInWeek: 3 };
    const plan = generatePushSession(state);
    const out = applyPushResult(state, logged(plan, '2026-07-20', 41), prs);
    expect(out.state.bestMaxSet).toBe(41);
    expect(out.newPrs.map((p) => p.kind)).toContain('pushMax');
    expect(out.state.week).toBe(2);
    expect(out.state.sessionInWeek).toBe(1);
  });

  it('manual pushCustom feeds bestMax but never advances', () => {
    const state = initialPushState(35);
    const log: LoggedSession = {
      id: 'm1',
      date: '2026-07-20',
      dayKind: 'pushCustom',
      cycle: 0,
      week: 0,
      sets: [{ targetReps: 44, actualReps: 44, loadKg: 0 }],
    };
    const out = applyPushResult(state, log, []);
    expect(out.state.bestMaxSet).toBe(44);
    expect(out.state.sessionInWeek).toBe(1);
    expect(out.state.week).toBe(1);
  });

  it('replaying a full 4-week cycle reproduces live application', () => {
    let state = initialPushState(35);
    const prs: PR[] = [];
    const sessions: LoggedSession[] = [];
    let d = 0;
    const nextDate = () => {
      d += 2;
      const dt = new Date('2026-07-20');
      dt.setDate(dt.getDate() + d);
      return dt.toISOString().slice(0, 10);
    };
    for (let i = 0; i < 12; i++) {
      const plan = generatePushSession(state);
      const log = logged(plan, nextDate(), plan.dayKind === 'pushTest' ? 39 : 36);
      sessions.push(log);
      const out = applyPushResult(state, log, prs);
      prs.push(...out.newPrs);
      state = out.state;
    }
    expect(state.cycle).toBe(2);
    const replayed = replayPushAll(35, sessions);
    expect(replayed.state).toEqual(state);
    expect(replayed.prs).toEqual(prs);
    expect(replayed.state.lastTestReps).toBe(39); // the test recalibrated
  });
});

describe('push goals', () => {
  it('targets the next milestone with a sane ETA', () => {
    const goal = computePushGoal({ ...initialPushState(35), lastTestReps: 35 }, '2026-07-20');
    expect(goal?.targetValue).toBe(40);
    expect(goal?.etaMonth).toMatch(/20\d\d/);
    const goal2 = computePushGoal({ ...initialPushState(85), lastTestReps: 85 }, '2026-07-20');
    expect(goal2?.targetValue).toBe(100);
  });
});
