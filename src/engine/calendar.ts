// Laying out a month — pure date arithmetic, no RN imports.
//
// Weeks start on Monday, so the training days the profile talks about
// (1 = Monday) line up with the columns you actually read. The point of the
// grid is that weekday patterns become visible: a column that is always empty
// says more than any streak counter could.

import type { ISODate } from './types';

export const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

function iso(y: number, m: number, d: number): ISODate {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Monday = 0 … Sunday = 6, from JS's Sunday-first getDay(). */
function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

/**
 * The calendar grid for a month: rows of seven, `null` where a cell belongs to
 * a neighbouring month. Always whole weeks, so the columns stay aligned.
 */
export function monthGrid(year: number, month: number): (ISODate | null)[][] {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const lead = mondayIndex(first);

  const cells: (ISODate | null)[] = Array(lead).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(iso(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (ISODate | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Step a year/month pair by whole months, rolling the year over. */
export function shiftMonth(
  year: number,
  month: number,
  delta: number
): { year: number; month: number } {
  const total = year * 12 + month + delta;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

export function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Which weekdays a set of dates fell on, Monday-first — the answer to "am I
 * actually training the days I think I am".
 */
export function weekdayTally(dates: ISODate[]): number[] {
  const out = [0, 0, 0, 0, 0, 0, 0];
  for (const d of dates) {
    const [y, m, day] = d.split('-').map(Number);
    if (!y || !m || !day) continue;
    out[mondayIndex(new Date(y, m - 1, day))] += 1;
  }
  return out;
}
