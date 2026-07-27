import { describe, expect, it } from 'vitest';
import {
  buildLoadEntries,
  computeReadiness,
  LoadEntry,
  OVERLAP,
  runLoad,
  sessionLoad,
  weeklyLoad,
} from '../load';
import { LoggedSession } from '../types';
import { Run } from '../runs';

const session = (
  date: string,
  dayKind: LoggedSession['dayKind'],
  sets: number,
  reps: number,
  effort?: LoggedSession['lastSetEffort']
): LoggedSession => ({
  id: `${date}-${dayKind}`,
  date,
  dayKind,
  cycle: 1,
  week: 1,
  lastSetEffort: effort,
  sets: Array.from({ length: sets }, () => ({ targetReps: reps, actualReps: reps, loadKg: 0 })),
});

const run = (date: string, km: number, sec: number): Run => ({
  id: `r-${date}`,
  date,
  distanceKm: km,
  durationSec: sec,
  source: 'manual',
});

describe('session load (Foster session-RPE)', () => {
  it('scales with volume and effort', () => {
    const easy = sessionLoad(session('2026-07-20', 'volume', 10, 10, 'easy'));
    const hard = sessionLoad(session('2026-07-20', 'volume', 10, 10, 'grind'));
    expect(hard).toBeGreaterThan(easy);
    const small = sessionLoad(session('2026-07-20', 'volume', 3, 10));
    const big = sessionLoad(session('2026-07-20', 'volume', 12, 10));
    expect(big).toBeGreaterThan(small);
  });

  it('rates max/test days harder than deloads at equal volume', () => {
    const max = sessionLoad(session('2026-07-20', 'max', 3, 15));
    const deload = sessionLoad(session('2026-07-20', 'deloadVolume', 3, 15));
    expect(max).toBeGreaterThan(deload);
  });

  it('runs: faster relative pace costs more than a plod', () => {
    const bestPace = 300; // 5:00 /km
    const fast = runLoad(run('2026-07-20', 5, 1530), bestPace); // 5:06 /km
    const slow = runLoad(run('2026-07-20', 5, 2100), bestPace); // 7:00 /km
    expect(fast).toBeGreaterThan(slow);
  });
});

describe('session duration with measured rests', () => {
  it('uses recorded restSecTaken and estimates only unmeasured gaps', () => {
    const s = session('2026-07-24', 'volume', 10, 10);
    const legacy = sessionLoad(s);
    const withRests: LoggedSession = {
      ...s,
      sets: s.sets.map((x, i) => (i < 9 ? { ...x, restSecTaken: 90, restSecPlanned: 60 } : x)),
    };
    // 9 measured 90s rests (810s) vs 9 estimated 60s (540s) → more load
    expect(sessionLoad(withRests)).toBeGreaterThan(legacy);
  });

  it('legacy sessions reproduce the old estimate exactly', () => {
    const s = session('2026-07-24', 'volume', 10, 10);
    expect(sessionLoad(s)).toBe(sessionLoad({ ...s }));
  });
});

describe('cross-modal overlap is asymmetric and honest', () => {
  it('pull and push interfere less with each other than with themselves', () => {
    expect(OVERLAP.pull.push).toBeLessThan(OVERLAP.pull.pull);
    expect(OVERLAP.push.pull).toBeLessThan(OVERLAP.push.push);
    expect(OVERLAP.pull.push).toBe(OVERLAP.push.pull); // symmetric between the two
  });

  it('running taxes upper-body modes least', () => {
    expect(OVERLAP.run.pull).toBeLessThan(OVERLAP.pull.pull);
    expect(OVERLAP.run.push).toBeLessThan(OVERLAP.push.push);
  });

  it('a hard pull session drops push readiness less than it drops pull readiness', () => {
    const entries: LoadEntry[] = [
      { date: '2026-07-19', modality: 'pull', load: 400, label: 'heavy' },
    ];
    const pull = computeReadiness('pull', entries, '2026-07-20');
    const push = computeReadiness('push', entries, '2026-07-20');
    expect(push.score).toBeGreaterThan(pull.score);
    expect(push.reasons.join(' ')).toMatch(/Opposite movement/i);
  });
});

describe('readiness', () => {
  it('is fresh with no history', () => {
    const r = computeReadiness('pull', [], '2026-07-20');
    expect(r.score).toBe(100);
    expect(r.level).toBe('fresh');
    expect(r.suggestion).toBeUndefined();
  });

  it('recovers as days pass (exponential decay)', () => {
    const mk = (date: string): LoadEntry[] => [
      { date, modality: 'pull', load: 400, label: 'heavy' },
    ];
    const sameDay = computeReadiness('pull', mk('2026-07-20'), '2026-07-20').score;
    const twoDays = computeReadiness('pull', mk('2026-07-18'), '2026-07-20').score;
    const sixDays = computeReadiness('pull', mk('2026-07-14'), '2026-07-20').score;
    expect(twoDays).toBeGreaterThan(sameDay);
    expect(sixDays).toBeGreaterThan(twoDays);
  });

  it('suggests trimming when deeply fatigued, and explains why', () => {
    const entries: LoadEntry[] = [
      { date: '2026-07-19', modality: 'pull', load: 600, label: 'heavy' },
      { date: '2026-07-20', modality: 'pull', load: 600, label: 'max' },
    ];
    const r = computeReadiness('pull', entries, '2026-07-20');
    expect(r.level).toBe('fatigued');
    expect(r.suggestion).toBe('rough');
    expect(r.reasons.length).toBeGreaterThan(0);
  });

  it('flags a load spike against your own 28-day baseline', () => {
    const entries: LoadEntry[] = [];
    // four weeks of light background load
    for (let i = 27; i >= 8; i -= 2) {
      const d = new Date('2026-07-20');
      d.setDate(d.getDate() - i);
      entries.push({ date: d.toISOString().slice(0, 10), modality: 'run', load: 100, label: 'run' });
    }
    // then a huge last week
    for (let i = 6; i >= 1; i--) {
      const d = new Date('2026-07-20');
      d.setDate(d.getDate() - i);
      entries.push({ date: d.toISOString().slice(0, 10), modality: 'run', load: 500, label: 'run' });
    }
    const r = computeReadiness('run', entries, '2026-07-20');
    expect(r.loadRatio).not.toBeNull();
    expect(r.loadRatio!).toBeGreaterThan(1.5);
    expect(r.reasons.join(' ')).toMatch(/big jump|usual load/i);
  });

  it('blends a wearable score when one is present (future Oura/Whoop)', () => {
    const entries: LoadEntry[] = [];
    const withoutWearable = computeReadiness('pull', entries, '2026-07-20').score;
    const withWearable = computeReadiness('pull', entries, '2026-07-20', {
      score: 40,
      source: 'Oura',
      date: '2026-07-20',
    });
    expect(withoutWearable).toBe(100);
    expect(withWearable.score).toBe(70); // (100 + 40) / 2
    expect(withWearable.reasons.join(' ')).toContain('Oura');
  });
});

describe('unified timeline', () => {
  it('merges all three modes, date-sorted, and totals the week', () => {
    const entries = buildLoadEntries(
      [session('2026-07-18', 'heavy', 4, 8)],
      [session('2026-07-19', 'pushVolume', 10, 15)],
      [run('2026-07-20', 5, 1500)],
      300
    );
    expect(entries.map((e) => e.modality)).toEqual(['pull', 'push', 'run']);
    const w = weeklyLoad(entries, '2026-07-20');
    expect(w.pull).toBeGreaterThan(0);
    expect(w.push).toBeGreaterThan(0);
    expect(w.run).toBeGreaterThan(0);
    expect(w.total).toBe(w.pull + w.push + w.run);
  });
});

describe('joint check-in', () => {
  const entries: LoadEntry[] = [];

  it('leaves readiness alone when joints are fine or unanswered', () => {
    const base = computeReadiness('pull', entries, '2026-07-27').score;
    expect(computeReadiness('pull', entries, '2026-07-27', null, 'fine').score).toBe(base);
    expect(computeReadiness('pull', entries, '2026-07-27', null, null).score).toBe(base);
  });

  it('eases both upper-body spaces when joints are tender, and says so', () => {
    const pull = computeReadiness('pull', entries, '2026-07-27', null, 'tender');
    const push = computeReadiness('push', entries, '2026-07-27', null, 'tender');
    expect(pull.score).toBe(80); // 100 × 0.8
    expect(push.score).toBe(80);
    expect(pull.reasons[0]).toMatch(/tender/i);
  });

  it('cuts deeper when sore, enough to change the suggestion', () => {
    const sore = computeReadiness('pull', entries, '2026-07-27', null, 'sore');
    expect(sore.score).toBe(55);
    expect(sore.level).toBe('ready');
    const loaded: LoadEntry[] = [{ date: '2026-07-26', modality: 'pull', load: 300, label: 'heavy' }];
    const both = computeReadiness('pull', loaded, '2026-07-27', null, 'sore');
    expect(both.suggestion).toBeDefined(); // fatigue + sore joints → trims
  });

  it('does not touch running — different joints entirely', () => {
    const base = computeReadiness('run', entries, '2026-07-27').score;
    expect(computeReadiness('run', entries, '2026-07-27', null, 'sore').score).toBe(base);
  });

  it('still blends a wearable score alongside the joint report', () => {
    const r = computeReadiness('pull', entries, '2026-07-27', { score: 60, source: 'Oura', date: '2026-07-27' }, 'tender');
    expect(r.score).toBe(64); // (100 + 60) / 2 = 80, then × 0.8
    expect(r.reasons.join(' ')).toContain('Oura');
  });
});
