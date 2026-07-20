import { describe, expect, it } from 'vitest';
import {
  fmtDuration,
  fmtPace,
  mergeRuns,
  normalizeDistanceKm,
  paceSecPerKm,
  Run,
  runStats,
  weeklyKmSeries,
} from '../runs';

const run = (id: string, date: string, km: number, sec: number, source: Run['source'] = 'health'): Run => ({
  id,
  date,
  distanceKm: km,
  durationSec: sec,
  source,
});

describe('pace & formatting', () => {
  it('computes and formats pace', () => {
    const p = paceSecPerKm({ distanceKm: 5, durationSec: 1650 }); // 5:30 /km
    expect(p).toBe(330);
    expect(fmtPace(p)).toBe('5:30 /km');
  });
  it('rejects nonsense paces', () => {
    expect(paceSecPerKm({ distanceKm: 0.01, durationSec: 600 })).toBeNull();
    expect(paceSecPerKm({ distanceKm: 5, durationSec: 10 })).toBeNull();
  });
  it('formats durations with and without hours', () => {
    expect(fmtDuration(1650)).toBe('27:30');
    expect(fmtDuration(3725)).toBe('1:02:05');
  });
});

describe('distance normalization (miles vs meters ambiguity)', () => {
  it('treats large values as meters', () => {
    expect(normalizeDistanceKm(5230)).toBe(5.23);
  });
  it('treats small values as miles', () => {
    expect(normalizeDistanceKm(3.11)).toBe(5.01); // 5k in miles
  });
  it('handles garbage', () => {
    expect(normalizeDistanceKm(NaN)).toBe(0);
    expect(normalizeDistanceKm(-2)).toBe(0);
  });
});

describe('mergeRuns', () => {
  it('dedupes by id, keeps date order, honors deletions', () => {
    const existing = [run('a', '2026-07-10', 5, 1650), run('b', '2026-07-12', 3, 1000)];
    const incoming = [
      run('a', '2026-07-10', 5, 1650), // duplicate → ignored
      run('c', '2026-07-08', 8, 2800), // new, older → sorts first
      run('d', '2026-07-14', 4, 1400), // new
      run('x', '2026-07-13', 6, 2000), // deleted by user → stays gone
    ];
    const merged = mergeRuns(existing, incoming, ['x']);
    expect(merged.map((r) => r.id)).toEqual(['c', 'a', 'b', 'd']);
  });
});

describe('runStats & weekly series', () => {
  // today = Sunday 2026-07-19; this week's Monday = 2026-07-13
  const today = '2026-07-19';
  const runs = [
    run('1', '2026-07-14', 5, 1650), // this week
    run('2', '2026-07-17', 10, 3600), // this week, longest
    run('3', '2026-07-06', 3, 1200), // previous week (within 4w)
    run('4', '2026-05-01', 7, 2400), // long ago
  ];

  it('aggregates correctly', () => {
    const s = runStats(runs, today);
    expect(s.thisWeekKm).toBe(15);
    expect(s.last4wKm).toBe(18);
    expect(s.totalKm).toBe(25);
    expect(s.totalRuns).toBe(4);
    expect(s.longestKm).toBe(10);
    expect(s.bestPaceSecPerKm).toBe(330); // run 1 (5:30) beats run 2 (6:00) and run 3 (6:40)
  });

  it('builds a fixed-length weekly series including empty weeks', () => {
    const series = weeklyKmSeries(runs, today, 4);
    expect(series).toHaveLength(4);
    expect(series[series.length - 1]).toEqual({ date: '2026-07-13', value: 15 });
    expect(series[0].value).toBe(0); // week of Jun 22 — no runs
    expect(series.find((w) => w.date === '2026-07-06')?.value).toBe(3);
  });
});
