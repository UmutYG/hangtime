import { describe, expect, it } from 'vitest';
import {
  ActiveWorkout,
  isResumable,
  sanitizeActiveWorkout,
  workoutMode,
  workoutProgress,
} from '../activeWorkout';
import { SessionPlan } from '../types';

const plan = (dayKind: SessionPlan['dayKind'], sets: number, warmups = 0): SessionPlan => ({
  dayKind,
  cycle: 1,
  week: 1,
  sessionInWeek: 2,
  title: 'Volume Day',
  sets: [
    ...Array.from({ length: warmups }, () => ({
      targetReps: 5,
      loadKg: 0,
      isWarmup: true,
      restSecAfter: 60,
    })),
    ...Array.from({ length: sets }, () => ({ targetReps: 10, loadKg: 0, restSecAfter: 60 })),
  ],
  decisions: [],
  why: '',
  whyDetail: '',
  progressionExempt: false,
});

const snap = (over: Partial<ActiveWorkout> = {}): ActiveWorkout => ({
  plan: plan('volume', 10),
  startedAt: '2026-07-27T09:00:00.000Z',
  warmupDone: true,
  actuals: {},
  restsTaken: {},
  ...over,
});

describe('workout progress', () => {
  it('counts logged working sets, ignoring warm-ups', () => {
    const w = snap({ plan: plan('volume', 10, 2), actuals: { 0: 5, 1: 3, 2: 10, 3: 10 } });
    // indices 0-1 are warm-ups; 2-3 are the first two working sets
    expect(workoutProgress(w)).toEqual({ logged: 2, total: 10 });
  });

  it('is zero on a fresh session', () => {
    expect(workoutProgress(snap())).toEqual({ logged: 0, total: 10 });
  });
});

describe('resumability', () => {
  it('offers a session with sets logged', () => {
    expect(isResumable(snap({ actuals: { 0: 10, 1: 10, 2: 10, 3: 10 } }))).toBe(true);
  });

  it('offers a session where only the warm-up got done', () => {
    expect(isResumable(snap({ warmupDone: true }))).toBe(true);
  });

  it('ignores a session that never got past start', () => {
    expect(isResumable(snap({ warmupDone: false }))).toBe(false);
  });

  it('ignores a fully-logged session — nothing left to resume', () => {
    const actuals: Record<number, number> = {};
    for (let i = 0; i < 10; i++) actuals[i] = 10;
    expect(isResumable(snap({ actuals }))).toBe(false);
  });

  it('ignores a plan with no sets', () => {
    expect(isResumable(snap({ plan: plan('volume', 0) }))).toBe(false);
  });
});

describe('mode ownership', () => {
  it('routes push day kinds to the push space, everything else to pull', () => {
    expect(workoutMode(snap({ plan: plan('pushVolume', 10) }))).toBe('pushups');
    expect(workoutMode(snap({ plan: plan('pushLadder', 4) }))).toBe('pushups');
    expect(workoutMode(snap({ plan: plan('volume', 10) }))).toBe('pullups');
    expect(workoutMode(snap({ plan: plan('heavy', 4) }))).toBe('pullups');
  });
});

describe('sanitizing what came off disk', () => {
  it('round-trips a real snapshot through JSON', () => {
    const w = snap({ actuals: { 0: 10, 1: 8 }, restsTaken: { 0: 75 } });
    const out = sanitizeActiveWorkout(JSON.parse(JSON.stringify(w)));
    expect(out).not.toBeNull();
    expect(out!.actuals[0]).toBe(10);
    expect(out!.actuals[1]).toBe(8);
    expect(out!.restsTaken[0]).toBe(75);
    expect(out!.plan.dayKind).toBe('volume');
  });

  it('rejects garbage instead of crashing', () => {
    expect(sanitizeActiveWorkout(null)).toBeNull();
    expect(sanitizeActiveWorkout('nope')).toBeNull();
    expect(sanitizeActiveWorkout(42)).toBeNull();
    expect(sanitizeActiveWorkout({})).toBeNull();
    expect(sanitizeActiveWorkout({ plan: {} })).toBeNull(); // no sets array
    expect(sanitizeActiveWorkout({ plan: plan('volume', 2) })).toBeNull(); // no startedAt
  });

  it('drops non-numeric rep entries rather than trusting them', () => {
    const out = sanitizeActiveWorkout({
      plan: plan('volume', 3),
      startedAt: '2026-07-27T09:00:00.000Z',
      warmupDone: true,
      actuals: { 0: 10, 1: 'ten', 2: null, x: 5, 3: Infinity },
      restsTaken: null,
    });
    expect(out).not.toBeNull();
    expect(out!.actuals).toEqual({ 0: 10 });
    expect(out!.restsTaken).toEqual({});
  });

  it('defaults warmupDone to false when absent', () => {
    const out = sanitizeActiveWorkout({
      plan: plan('volume', 3),
      startedAt: '2026-07-27T09:00:00.000Z',
    });
    expect(out!.warmupDone).toBe(false);
  });
});
