import { describe, expect, it } from 'vitest';
import { monthGrid, monthLabel, shiftMonth, weekdayTally } from '../calendar';

describe('monthGrid', () => {
  it('lays out whole weeks of seven', () => {
    for (let m = 0; m < 12; m++) {
      const g = monthGrid(2026, m);
      for (const w of g) expect(w).toHaveLength(7);
    }
  });

  it('starts weeks on Monday', () => {
    // 1 Aug 2026 is a Saturday, so it sits in the 6th column
    const g = monthGrid(2026, 7);
    expect(g[0][5]).toBe('2026-08-01');
    expect(g[0].slice(0, 5).every((c) => c === null)).toBe(true);
  });

  it('holds every day of the month exactly once, in order', () => {
    const g = monthGrid(2026, 1); // February
    const days = g.flat().filter(Boolean) as string[];
    expect(days).toHaveLength(28);
    expect(days[0]).toBe('2026-02-01');
    expect(days[27]).toBe('2026-02-28');
    expect(new Set(days).size).toBe(28);
    expect([...days].sort()).toEqual(days);
  });

  it('handles a leap February', () => {
    const days = monthGrid(2028, 1).flat().filter(Boolean);
    expect(days).toHaveLength(29);
    expect(days[28]).toBe('2028-02-29');
  });

  it('pads only outside the month', () => {
    const g = monthGrid(2026, 7);
    const flat = g.flat();
    const firstReal = flat.findIndex((c) => c !== null);
    const lastReal = flat.length - 1 - [...flat].reverse().findIndex((c) => c !== null);
    // no gaps in the middle
    expect(flat.slice(firstReal, lastReal + 1).every((c) => c !== null)).toBe(true);
  });
});

describe('shiftMonth', () => {
  it('rolls over both ends of the year', () => {
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
    expect(shiftMonth(2026, 5, 0)).toEqual({ year: 2026, month: 5 });
  });

  it('survives large jumps in both directions', () => {
    expect(shiftMonth(2026, 3, -25)).toEqual({ year: 2024, month: 2 });
    expect(shiftMonth(2026, 3, 25)).toEqual({ year: 2028, month: 4 });
  });
});

describe('weekdayTally', () => {
  it('counts Monday first', () => {
    // 2026-08-03 is a Monday, 2026-08-09 a Sunday
    expect(weekdayTally(['2026-08-03'])).toEqual([1, 0, 0, 0, 0, 0, 0]);
    expect(weekdayTally(['2026-08-09'])).toEqual([0, 0, 0, 0, 0, 0, 1]);
  });

  it('adds up repeats and ignores unparseable dates', () => {
    const t = weekdayTally(['2026-08-03', '2026-08-10', '2026-08-05', 'nonsense', '']);
    expect(t[0]).toBe(2); // two Mondays
    expect(t[2]).toBe(1); // one Wednesday
    expect(t.reduce((a, b) => a + b, 0)).toBe(3);
  });
});

describe('monthLabel', () => {
  it('names the month and year', () => {
    expect(monthLabel(2026, 7)).toMatch(/2026/);
  });
});
