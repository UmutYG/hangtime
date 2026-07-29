import { describe, expect, it } from 'vitest';
import { generateSession, initialState } from '../generator';
import {
  pullMasteryPath,
  pullVariationFor,
  pullVolumeBlocks,
  PULL_SIMPLE_KEYS,
  PULL_TIER_THRESHOLDS,
  PULL_VARIATIONS,
} from '../pullVariations';
import { LoggedSession, Profile, ProgramState } from '../types';

const profile: Profile = {
  bodyweightKg: 82,
  startingMax: 19,
  equipment: { mode: 'fixed', fixedLoadKg: 7.5, smallestPlateKg: 1.25 },
  trainingDays: [1, 3, 5],
  createdAt: '2026-07-20',
};

const at = (week: 1 | 2 | 3 | 4, sessionInWeek: 1 | 2 | 3, cycle = 1): ProgramState => ({
  ...initialState(profile),
  cycle,
  week,
  sessionInWeek,
});

describe('the library itself', () => {
  it('scales relative to a standard pull-up in the right direction', () => {
    const scale = (k: string) => PULL_VARIATIONS.find((v) => v.key === k)!.scale;
    expect(scale('standard')).toBe(1);
    expect(scale('chinup')).toBeGreaterThan(1); // easier → more reps
    expect(scale('wide')).toBeLessThan(1); // harder → fewer
    expect(scale('archer')).toBeLessThan(scale('wide')); // hardest of all
  });

  it('gives every movement a name and a reason to exist', () => {
    for (const v of PULL_VARIATIONS) {
      expect(v.name.length).toBeGreaterThan(2);
      expect(v.flavor.length).toBeGreaterThan(15);
    }
  });
});

describe('volume day grip blocks', () => {
  const state = at(1, 2);

  it('is deterministic', () => {
    expect(pullVolumeBlocks(state, 10, 10)).toEqual(pullVolumeBlocks(state, 10, 10));
  });

  it('splits into 2–3 blocks of distinct simple grips, summing to the set count', () => {
    for (const s of [at(1, 2), at(2, 2), at(3, 2), at(1, 2, 2), at(2, 2, 3)]) {
      const blocks = pullVolumeBlocks(s, 10, 10);
      expect(blocks.length === 2 || blocks.length === 3).toBe(true);
      expect(blocks.reduce((a, b) => a + b.sets, 0)).toBe(10);
      const keys = blocks.map((b) => b.variation.key);
      expect(new Set(keys).size).toBe(keys.length);
      for (const k of keys) expect(PULL_SIMPLE_KEYS).toContain(k);
    }
  });

  it('never puts a skill movement in the middle of a rhythm day', () => {
    for (const s of [at(1, 2), at(2, 2), at(3, 2)]) {
      for (const b of pullVolumeBlocks(s, 10, 10)) {
        expect(['archer', 'lsit', 'tempo', 'towel', 'chestbar']).not.toContain(b.variation.key);
      }
    }
  });

  it('scales reps per grip with a floor', () => {
    for (const b of pullVolumeBlocks(state, 10, 10)) {
      expect(b.reps).toBe(Math.max(2, Math.round(10 * b.variation.scale)));
    }
    for (const b of pullVolumeBlocks(state, 10, 2)) expect(b.reps).toBeGreaterThanOrEqual(2);
  });
});

describe('ladder day rotates the whole library', () => {
  it('gives each ladder its own shape, carried on every rung', () => {
    const state = at(2, 3); // week 2 session 3 = ladder day
    const plan = generateSession(profile, state, '2026-07-28');
    expect(plan.dayKind).toBe('ladder');
    const byLadder = new Map<number, Set<string>>();
    for (const set of plan.sets) {
      expect(set.variation?.key).toBeDefined();
      const idx = set.ladder!.ladderIndex;
      if (!byLadder.has(idx)) byLadder.set(idx, new Set());
      byLadder.get(idx)!.add(set.variation!.key);
    }
    // one variation per ladder, and the ladders differ from each other
    for (const keys of byLadder.values()) expect(keys.size).toBe(1);
    const perLadder = [...byLadder.values()].map((s) => [...s][0]);
    expect(new Set(perLadder).size).toBe(perLadder.length);
    for (const k of perLadder) expect(k).not.toBe('standard');
  });

  it('shortens the ladder for a harder shape', () => {
    const state = at(2, 3);
    const plan = generateSession(profile, state, '2026-07-28');
    for (const set of plan.sets) {
      const v = pullVariationFor(state, set.ladder!.ladderIndex - 1);
      expect(set.variation!.key).toBe(v.key);
    }
  });
});

describe('measurement days stay standard', () => {
  it('heavy, max and test days carry no variation at all', () => {
    for (const s of [at(1, 1), at(1, 3), at(4, 3), at(4, 1)]) {
      const plan = generateSession(profile, s, '2026-07-28');
      expect(plan.sets.every((x) => x.variation === undefined)).toBe(true);
    }
  });
});

describe('pull mastery path', () => {
  const logged = (key: string | undefined, reps: number): LoggedSession => ({
    id: `s-${key}`,
    date: '2026-07-27',
    dayKind: 'volume',
    cycle: 1,
    week: 1,
    sets: [{ targetReps: reps, actualReps: reps, loadKg: 0, variationKey: key }],
  });

  it('counts legacy sets as standard and opens tiers on cumulative work', () => {
    const path = pullMasteryPath([logged(undefined, 50), logged('chinup', 30)]);
    expect(path[0].open).toBe(true);
    expect(path[0].items.find((i) => i.variation.key === 'standard')!.reps).toBe(50);
    expect(path[0].items.find((i) => i.variation.key === 'chinup')!.reps).toBe(30);
    expect(path[1].open).toBe(false);
  });

  it('opens the second tier once the grips add up', () => {
    const path = pullMasteryPath([logged('standard', PULL_TIER_THRESHOLDS[1])]);
    expect(path[1].open).toBe(true);
  });

  it('covers every movement in the library exactly once', () => {
    const keys = pullMasteryPath([]).flatMap((t) => t.items.map((i) => i.variation.key));
    expect(new Set(keys).size).toBe(PULL_VARIATIONS.length);
  });
});
