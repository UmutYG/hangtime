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
  defaultPushVolumeTune,
  nextPushVolumeTune,
  PUSH_SIMPLE_KEYS,
  PUSH_VOLUME_SETS,
  PUSH_TIER_THRESHOLDS,
  resolvePushDayKind,
} from '../pushups';
import { LoggedSession, PR, PushState, SessionPlan, VolumeTune } from '../types';

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

// ——— volume autoregulation (block-safe fade) ———

function pushVolumeLog(
  sets: Array<{ target: number; actual: number; rest?: number }>,
  opts?: { planned?: number; exempt?: boolean; dayKind?: LoggedSession['dayKind'] }
): LoggedSession {
  const planned = opts?.planned ?? 60;
  return {
    id: 'pv-1',
    date: '2026-07-27',
    dayKind: opts?.dayKind ?? 'pushVolume',
    cycle: 1,
    week: 1,
    progressionExempt: opts?.exempt,
    sets: sets.map((s, i) => ({
      targetReps: s.target,
      actualReps: s.actual,
      loadKg: 0,
      restSecTaken: s.rest,
      restSecPlanned: i === sets.length - 1 ? 0 : planned,
    })),
  };
}

/** 10 sets across two blocks with different targets — the shape a real push volume day has */
const blocked = (early: number, late: number, rest?: number) => [
  ...Array.from({ length: 5 }, () => ({ target: 15, actual: early, rest })),
  ...Array.from({ length: 5 }, () => ({ target: 10, actual: late, rest })),
];

describe('push volume autoregulation', () => {
  it('measures fade by fulfilment, so a low-rep block is not read as a collapse', () => {
    // both blocks fully met: 15/15 early, 10/10 late — raw reps drop 33 %, fulfilment is flat
    const t = nextPushVolumeTune(defaultPushVolumeTune(), pushVolumeLog(blocked(15, 10)));
    expect(t.lastDropOff).toBeCloseTo(1, 5);
    expect(t.lastCompletionPct).toBeCloseTo(1, 5);
    expect(t.lastOutcome).toBe('crisp');
    expect(t.restSec).toBe(60);
    expect(t.repAdj).toBe(0);
  });

  it('catches a real fade inside the blocks', () => {
    // early block met, late block at 60 % → fulfilment fade 0.6
    const t = nextPushVolumeTune(defaultPushVolumeTune(), pushVolumeLog(blocked(15, 6)));
    expect(t.lastDropOff).toBeCloseTo(0.6, 5);
    expect(t.lastOutcome).toBe('breakdown');
    expect(t.restSec).toBe(75);
    expect(t.repAdj).toBe(-1);
  });

  it('raises rest only on a moderate shortfall', () => {
    const t = nextPushVolumeTune(defaultPushVolumeTune(), pushVolumeLog(blocked(14, 9)));
    expect(t.lastOutcome).toBe('moderate');
    expect(t.restSec).toBe(75);
    expect(t.repAdj).toBe(0);
  });

  it('treats stretched rests as moderate even at full completion', () => {
    const t = nextPushVolumeTune(defaultPushVolumeTune(), pushVolumeLog(blocked(15, 10, 80)));
    expect(t.lastRestOverage).toBeCloseTo(80 / 60, 5);
    expect(t.lastOutcome).toBe('moderate');
    expect(t.restSec).toBe(75);
  });

  it('walks back to baseline on crisp days, with a one-shot restored', () => {
    let tune: VolumeTune = { ...defaultPushVolumeTune(), restSec: 90, repAdj: -2 };
    const crisp = () => pushVolumeLog(blocked(15, 10));
    const seq: Array<[number, number, string]> = [
      [75, -2, 'crisp'],
      [60, -2, 'crisp'],
      [60, -1, 'crisp'],
      [60, 0, 'restored'],
      [60, 0, 'crisp'],
    ];
    for (const [rest, adj, outcome] of seq) {
      tune = nextPushVolumeTune(tune, crisp());
      expect([tune.restSec, tune.repAdj, tune.lastOutcome]).toEqual([rest, adj, outcome]);
    }
  });

  it('pins at rest 90 / repAdj -2 under repeated breakdowns', () => {
    let tune = defaultPushVolumeTune();
    for (let i = 0; i < 4; i++) tune = nextPushVolumeTune(tune, pushVolumeLog(blocked(8, 3)));
    expect(tune.restSec).toBe(90);
    expect(tune.repAdj).toBe(-2);
  });

  it('has no rest overage when the log carries no rest data', () => {
    const t = nextPushVolumeTune(defaultPushVolumeTune(), pushVolumeLog(blocked(15, 10)));
    expect(t.lastRestOverage).toBeNull();
  });
});

describe('push tune wiring', () => {
  const state = initialPushState(30);

  it('applyPushResult tunes on volume days and skips exempt/deload ones', () => {
    const faded = pushVolumeLog(blocked(15, 6));
    expect(applyPushResult(state, faded, []).state.volumeTune.repAdj).toBe(-1);

    const exempt = pushVolumeLog(blocked(15, 6), { exempt: true });
    expect(applyPushResult(state, exempt, []).state.volumeTune).toEqual(defaultPushVolumeTune());

    const deload = pushVolumeLog(blocked(15, 6), { dayKind: 'pushDeload' });
    expect(applyPushResult(state, deload, []).state.volumeTune).toEqual(defaultPushVolumeTune());
  });

  it('a push test resets the tune', () => {
    const tuned: PushState = {
      ...state,
      volumeTune: { ...defaultPushVolumeTune(), restSec: 90, repAdj: -2 },
    };
    const test: LoggedSession = {
      id: 'pt', date: '2026-07-27', dayKind: 'pushTest', cycle: 1, week: 4,
      sets: [{ targetReps: 32, actualReps: 34, loadKg: 0 }],
    };
    expect(applyPushResult(tuned, test, []).state.volumeTune).toEqual(defaultPushVolumeTune());
  });

  it('does not mutate the previous tune', () => {
    const before = initialPushState(30);
    const frozen = JSON.stringify(before.volumeTune);
    applyPushResult(before, pushVolumeLog(blocked(15, 6)), []);
    expect(JSON.stringify(before.volumeTune)).toBe(frozen);
  });

  it('the generator applies repAdj to every block and uses the tuned rest', () => {
    const tuned: PushState = {
      ...state,
      week: 1,
      sessionInWeek: 2,
      volumeTune: { ...defaultPushVolumeTune(), restSec: 75, repAdj: -1, lastCompletionPct: 0.84, lastOutcome: 'breakdown' },
    };
    const plan = generatePushSession(tuned);
    expect(plan.dayKind).toBe('pushVolume');
    const baseline = pushVolumeBlocks(tuned, 10, 30, 0);
    const adjusted = pushVolumeBlocks(tuned, 10, 30, -1);
    adjusted.forEach((b, i) => expect(b.reps).toBe(Math.max(3, baseline[i].reps - 1)));
    const working = plan.sets.filter((s) => !s.isWarmup);
    expect(working.slice(0, -1).every((s) => s.restSecAfter === 75)).toBe(true);
    expect(plan.why).toContain('84');
  });

  it('replaying push sessions reproduces the tune', () => {
    const sessions = [
      pushVolumeLog(blocked(15, 6)),
      { ...pushVolumeLog(blocked(14, 9), { planned: 75 }), id: 'pv-2', date: '2026-07-29' },
    ];
    let live = initialPushState(30);
    for (const s of sessions) live = applyPushResult(live, s, []).state;
    expect(replayPushAll(30, sessions).state.volumeTune).toEqual(live.volumeTune);
  });
});

describe('push layoff ramp', () => {
  const base = { ...initialPushState(30), lastSessionDate: '2026-07-01' };

  it('trims and exempts a session after 8+ days off, and says why', () => {
    const plan = generatePushSession({ ...base, sessionInWeek: 2 }, undefined, '2026-07-15');
    expect(plan.progressionExempt).toBe(true);
    expect(plan.sets.filter((s) => !s.isWarmup)).toHaveLength(PUSH_VOLUME_SETS - 2);
    expect(plan.why).toContain('14 days');
    expect(plan.decisions[0].code).toBe('LAYOFF_RAMP');
  });

  it('eases rep targets on the ramp-back day', () => {
    const normal = generatePushSession({ ...base, sessionInWeek: 2 }, undefined, '2026-07-03');
    const ramp = generatePushSession({ ...base, sessionInWeek: 2 }, undefined, '2026-07-15');
    const first = (p: SessionPlan) => p.sets.filter((s) => !s.isWarmup)[0].targetReps;
    expect(first(ramp)).toBeLessThan(first(normal));
  });

  it('leaves a normal gap completely alone', () => {
    const plan = generatePushSession({ ...base, sessionInWeek: 2 }, undefined, '2026-07-03');
    expect(plan.progressionExempt).toBe(false);
    expect(plan.sets.filter((s) => !s.isWarmup)).toHaveLength(PUSH_VOLUME_SETS);
    expect(plan.why).not.toContain('days since');
  });

  it('does nothing without a today date or a previous session', () => {
    expect(generatePushSession({ ...base, sessionInWeek: 2 }).progressionExempt).toBe(false);
    const fresh = { ...initialPushState(30), sessionInWeek: 2 as const };
    expect(generatePushSession(fresh, undefined, '2026-12-01').progressionExempt).toBe(false);
  });

  it('a ramp-back session cannot move the tune or the max', () => {
    const tuned: PushState = {
      ...base,
      volumeTune: { ...defaultPushVolumeTune(), restSec: 75, repAdj: -1 },
    };
    const plan = generatePushSession({ ...tuned, sessionInWeek: 2 }, undefined, '2026-07-15');
    const log: LoggedSession = {
      id: 'ramp', date: '2026-07-15', dayKind: plan.dayKind, cycle: 1, week: 1,
      progressionExempt: plan.progressionExempt,
      sets: plan.sets.map((s) => ({ targetReps: s.targetReps, actualReps: 2, loadKg: 0, isWarmup: s.isWarmup })),
    };
    const out = applyPushResult(tuned, log, []);
    expect(out.state.volumeTune.restSec).toBe(75);
    expect(out.state.volumeTune.repAdj).toBe(-1);
    expect(out.state.bestMaxSet).toBe(30);
  });
});
