import { describe, expect, it } from 'vitest';
import { mergeStores, storeDiffers } from '../merge';
import { initialState } from '../generator';
import { initialPushState } from '../pushups';
import { LoggedSession, Profile, Store } from '../types';
import { Run } from '../runs';

const profile: Profile = {
  bodyweightKg: 82,
  startingMax: 19,
  equipment: { mode: 'fixed', fixedLoadKg: 7.5, smallestPlateKg: 1.25 },
  trainingDays: [1, 3, 5],
  createdAt: '2026-07-01',
};

function baseStore(updatedAt: string): Store {
  return {
    version: 1,
    profile,
    state: initialState(profile),
    sessions: [],
    prs: [],
    tests: [],
    lifetimeReps: 0,
    trash: [],
    runs: [],
    deletedRunIds: [],
    healthEnabled: false,
    appMode: 'pullups',
    pushState: null,
    pushStartingMax: 0,
    pushSessions: [],
    pushTrash: [],
    pushLifetimeReps: 0,
    externalReadiness: null,
    updatedAt,
  };
}

const session = (id: string, date: string, dayKind: LoggedSession['dayKind'] = 'volume'): LoggedSession => ({
  id,
  date,
  dayKind,
  cycle: 1,
  week: 1,
  sets: Array.from({ length: 10 }, () => ({ targetReps: 10, actualReps: 10, loadKg: 0 })),
});

const run = (id: string, date: string): Run => ({
  id,
  date,
  distanceKm: 5,
  durationSec: 1500,
  source: 'manual',
});

describe('merging two devices', () => {
  it('keeps sessions from both sides instead of letting the newer one win', () => {
    const local = { ...baseStore('2026-07-27T10:00:00Z'), sessions: [session('a', '2026-07-20')] };
    const cloud = { ...baseStore('2026-07-27T12:00:00Z'), sessions: [session('b', '2026-07-22')] };
    const merged = mergeStores(local, cloud);
    expect(merged.sessions.map((s) => s.id)).toEqual(['a', 'b']);
  });

  it('is symmetric — merge order does not change the outcome', () => {
    const local = { ...baseStore('2026-07-27T10:00:00Z'), sessions: [session('a', '2026-07-20')] };
    const cloud = { ...baseStore('2026-07-27T12:00:00Z'), sessions: [session('b', '2026-07-22')] };
    expect(mergeStores(local, cloud).sessions.map((s) => s.id)).toEqual(
      mergeStores(cloud, local).sessions.map((s) => s.id)
    );
  });

  it('keeps sessions date-sorted so replay runs in the right order', () => {
    const local = { ...baseStore('2026-07-27T10:00:00Z'), sessions: [session('late', '2026-07-25')] };
    const cloud = { ...baseStore('2026-07-27T12:00:00Z'), sessions: [session('early', '2026-07-10')] };
    expect(mergeStores(local, cloud).sessions.map((s) => s.id)).toEqual(['early', 'late']);
  });

  it('prefers the newer copy when the same session was edited on both', () => {
    const mine = session('a', '2026-07-20');
    const edited = { ...session('a', '2026-07-20'), sets: [{ targetReps: 10, actualReps: 3, loadKg: 0 }] };
    const local = { ...baseStore('2026-07-27T10:00:00Z'), sessions: [mine] };
    const cloud = { ...baseStore('2026-07-27T12:00:00Z'), sessions: [edited] };
    const merged = mergeStores(local, cloud);
    expect(merged.sessions).toHaveLength(1);
    expect(merged.sessions[0].sets).toHaveLength(1); // the cloud (newer) version
  });

  it('lets a deletion on one device win over presence on the other', () => {
    const s = session('a', '2026-07-20');
    const local = { ...baseStore('2026-07-27T10:00:00Z'), sessions: [], trash: [s] };
    const cloud = { ...baseStore('2026-07-27T12:00:00Z'), sessions: [s], trash: [] };
    const merged = mergeStores(local, cloud);
    expect(merged.sessions).toHaveLength(0);
    expect(merged.trash.map((x) => x.id)).toEqual(['a']); // still recoverable
  });

  it('merges runs and honours deletions from either side', () => {
    const local = {
      ...baseStore('2026-07-27T10:00:00Z'),
      runs: [run('r1', '2026-07-20')],
      deletedRunIds: ['r3'],
    };
    const cloud = {
      ...baseStore('2026-07-27T12:00:00Z'),
      runs: [run('r2', '2026-07-21'), run('r3', '2026-07-22')],
      deletedRunIds: [],
    };
    const merged = mergeStores(local, cloud);
    expect(merged.runs.map((r) => r.id).sort()).toEqual(['r1', 'r2']);
    expect(merged.deletedRunIds).toContain('r3');
  });

  it('merges push history and rebuilds push state from the starting max', () => {
    const local = {
      ...baseStore('2026-07-27T10:00:00Z'),
      pushState: initialPushState(30),
      pushStartingMax: 30,
      pushSessions: [session('p1', '2026-07-20', 'pushVolume')],
    };
    const cloud = {
      ...baseStore('2026-07-27T12:00:00Z'),
      pushState: initialPushState(30),
      pushStartingMax: 30,
      pushSessions: [session('p2', '2026-07-22', 'pushVolume')],
    };
    const merged = mergeStores(local, cloud);
    expect(merged.pushSessions.map((s) => s.id)).toEqual(['p1', 'p2']);
    expect(merged.pushLifetimeReps).toBe(200); // both sessions counted
  });

  it('recomputes derived state from the merged log rather than copying it', () => {
    const local = {
      ...baseStore('2026-07-27T10:00:00Z'),
      sessions: [session('a', '2026-07-20')],
      lifetimeReps: 999, // deliberately wrong
    };
    const cloud = { ...baseStore('2026-07-27T12:00:00Z'), sessions: [session('b', '2026-07-22')] };
    const merged = mergeStores(local, cloud);
    expect(merged.lifetimeReps).toBe(200); // 2 sessions × 100 reps, replayed
  });

  it('restores a fresh install from the cloud', () => {
    const fresh = { ...baseStore('2026-07-27T09:00:00Z'), profile: null };
    const cloud = { ...baseStore('2026-07-27T12:00:00Z'), sessions: [session('a', '2026-07-20')] };
    const merged = mergeStores(fresh, cloud);
    expect(merged.profile).not.toBeNull();
    expect(merged.sessions.map((s) => s.id)).toEqual(['a']);
  });

  it('never stamps a write time newer than either device produced', () => {
    const local = baseStore('2026-07-27T10:00:00Z');
    const cloud = baseStore('2026-07-27T12:00:00Z');
    expect(mergeStores(local, cloud).updatedAt).toBe('2026-07-27T12:00:00Z');
  });

  it('merges joint check-ins, newest write winning per day', () => {
    const local = {
      ...baseStore('2026-07-27T10:00:00Z'),
      jointLog: [{ date: '2026-07-26', feel: 'fine' as const }, { date: '2026-07-27', feel: 'fine' as const }],
    };
    const cloud = {
      ...baseStore('2026-07-27T12:00:00Z'),
      jointLog: [{ date: '2026-07-27', feel: 'tender' as const }],
    };
    const merged = mergeStores(local, cloud);
    expect(merged.jointLog).toEqual([
      { date: '2026-07-26', feel: 'fine' },
      { date: '2026-07-27', feel: 'tender' },
    ]);
  });
});

describe('storeDiffers', () => {
  it('is false for identical histories and true once one gains a session', () => {
    const a = { ...baseStore('2026-07-27T10:00:00Z'), sessions: [session('a', '2026-07-20')] };
    const b = { ...baseStore('2026-07-27T12:00:00Z'), sessions: [session('a', '2026-07-20')] };
    expect(storeDiffers(a, b)).toBe(false);
    expect(storeDiffers(a, { ...b, sessions: [...b.sessions, session('c', '2026-07-21')] })).toBe(true);
  });
});
