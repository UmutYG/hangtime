import { describe, expect, it } from 'vitest';
import {
  applyPushResult,
  computePushGoal,
  generatePushSession,
  initialPushState,
  replayPushAll,
  pushMasteryPath,
  pushVariationFor,
  pushVariationTotals,
  pushVolumeBlocks,
  PUSH_SIMPLE_KEYS,
  PUSH_TIER_THRESHOLDS,
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

  it('volume: 10 sets in grip blocks, reps scaled per block from 50 % of max', () => {
    const s = { ...state, sessionInWeek: 2 as const };
    const plan = generatePushSession(s);
    const blocks = pushVolumeBlocks(s, 10, 40);
    expect(plan.sets).toHaveLength(10);
    expect(plan.sets.reduce((sum, x) => sum + (x.variation ? 0 : 1), 0)).toBe(0); // every set tagged
    // sets follow the blocks contiguously
    let i = 0;
    for (const block of blocks) {
      for (let j = 0; j < block.sets; j++, i++) {
        expect(plan.sets[i].variation?.key).toBe(block.variation.key);
        expect(plan.sets[i].targetReps).toBe(block.reps);
        if (j === 0) expect(plan.sets[i].note).toContain(block.variation.name);
      }
      expect(plan.why.toLowerCase()).toContain(block.variation.name.toLowerCase());
    }
    expect(plan.sets[plan.sets.length - 1].restSecAfter).toBe(0);
  });

  it('variation rotation is deterministic and skips standard', () => {
    const s = { ...state, sessionInWeek: 2 as const };
    expect(pushVariationFor(s).key).toBe(pushVariationFor(s).key);
    expect(pushVariationFor(s).key).not.toBe('standard');
    // ladder day: each ladder gets its own variation, carried on every rung
    const ladderPlan = generatePushSession({ ...state, week: 2, sessionInWeek: 3 });
    const firstRungNotes = ladderPlan.sets.filter((x) => x.ladder?.rung === 1).map((x) => x.note);
    expect(new Set(firstRungNotes).size).toBe(firstRungNotes.length); // all different
    for (const set of ladderPlan.sets) {
      expect(set.variation?.key).toBeDefined();
      const expected = pushVariationFor(
        { ...state, week: 2, sessionInWeek: 3 },
        (set.ladder!.ladderIndex ?? 1) - 1
      );
      expect(set.variation?.key).toBe(expected.key);
    }
  });

  it('measurement days carry no variation tag', () => {
    for (const s of [
      state, // pyramid
      { ...state, week: 1 as const, sessionInWeek: 3 as const }, // max
      { ...state, week: 4 as const, sessionInWeek: 1 as const }, // deload
      { ...state, week: 4 as const, sessionInWeek: 3 as const }, // test
    ]) {
      const plan = generatePushSession(s);
      expect(plan.sets.every((x) => x.variation === undefined)).toBe(true);
    }
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

describe('volume blocks', () => {
  const state = initialPushState(40);

  it('is deterministic — same state gives identical blocks', () => {
    const s = { ...state, sessionInWeek: 2 as const };
    expect(pushVolumeBlocks(s, 10, 40)).toEqual(pushVolumeBlocks(s, 10, 40));
  });

  it('splits contiguously, sums to the total, 2 or 3 blocks, distinct simple grips', () => {
    const states = [
      { ...state, cycle: 1, week: 1 as const, sessionInWeek: 2 as const },
      { ...state, cycle: 1, week: 2 as const, sessionInWeek: 2 as const },
      { ...state, cycle: 1, week: 3 as const, sessionInWeek: 2 as const },
      { ...state, cycle: 2, week: 1 as const, sessionInWeek: 2 as const },
      { ...state, cycle: 3, week: 2 as const, sessionInWeek: 2 as const },
    ];
    for (const s of states) {
      for (const total of [10, 8]) {
        const blocks = pushVolumeBlocks(s, total, 40);
        expect(blocks.length === 2 || blocks.length === 3).toBe(true);
        expect(blocks.reduce((sum, b) => sum + b.sets, 0)).toBe(total);
        const keys = blocks.map((b) => b.variation.key);
        expect(new Set(keys).size).toBe(keys.length); // no repeated grip
        for (const k of keys) expect(PUSH_SIMPLE_KEYS).toContain(k);
      }
    }
  });

  it('different weeks bring different grip mixes', () => {
    const w1 = pushVolumeBlocks({ ...state, week: 1, sessionInWeek: 2 }, 10, 40);
    const w2 = pushVolumeBlocks({ ...state, week: 2, sessionInWeek: 2 }, 10, 40);
    expect(w1.map((b) => b.variation.key)).not.toEqual(w2.map((b) => b.variation.key));
  });

  it('reps are scale-adjusted with a floor of 3', () => {
    const s = { ...state, sessionInWeek: 2 as const };
    for (const b of pushVolumeBlocks(s, 10, 40)) {
      expect(b.reps).toBe(Math.max(3, Math.ceil(40 * 0.5 * b.variation.scale)));
    }
    // tiny max: everything floors at 3
    for (const b of pushVolumeBlocks(s, 10, 5)) expect(b.reps).toBeGreaterThanOrEqual(3);
  });
});

describe('mastery path', () => {
  const mk = (sets: Array<{ reps: number; key?: string; warmup?: boolean }>): LoggedSession => ({
    id: 'x',
    date: '2026-07-22',
    dayKind: 'pushVolume',
    cycle: 1,
    week: 1,
    sets: sets.map((s) => ({
      targetReps: s.reps,
      actualReps: s.reps,
      loadKg: 0,
      isWarmup: s.warmup,
      variationKey: s.key,
    })),
  });

  it('totals per variation; legacy sets count as standard; warmups excluded', () => {
    const totals = pushVariationTotals([
      mk([
        { reps: 5, warmup: true }, // excluded
        { reps: 20 }, // legacy → standard
        { reps: 15, key: 'wide' },
        { reps: 10, key: 'diamond' },
        { reps: 10, key: 'wide' },
      ]),
    ]);
    expect(totals.standard).toBe(20);
    expect(totals.wide).toBe(25);
    expect(totals.diamond).toBe(10);
  });

  it('tier 1 always open; later tiers open on cumulative earlier reps; closed-tier reps still shown', () => {
    const none = pushMasteryPath([]);
    expect(none[0].open).toBe(true);
    expect(none[1].open).toBe(false);

    // enough foundation reps to open tier 2 but not tier 3
    const sessions = [
      mk([{ reps: PUSH_TIER_THRESHOLDS[1], key: 'standard' }, { reps: 12, key: 'archer' }]),
    ];
    const path = pushMasteryPath(sessions);
    expect(path[1].open).toBe(true);
    expect(path[2].open).toBe(false);
    // archer reps display even though Power tier is closed
    const power = path[3];
    expect(power.open).toBe(false);
    expect(power.items.find((i) => i.variation.key === 'archer')?.reps).toBe(12);
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
