// Calendar awareness — pure logic, no RN imports.
//
// Onboarding asks which days you train. Everything that wants to say "when"
// rather than "in how many sessions" reads it through here, so the app never
// claims days when it means sessions.

import { ISODate } from './types';

const MS_PER_DAY = 86_400_000;

function toDate(iso: ISODate): Date {
  return new Date(iso + 'T12:00:00');
}

function toIso(d: Date): ISODate {
  return d.toISOString().slice(0, 10);
}

/** Is this date one of the chosen training days? */
export function isTrainingDay(trainingDays: number[], iso: ISODate): boolean {
  if (trainingDays.length === 0) return true; // no schedule set → every day is fair game
  return trainingDays.includes(toDate(iso).getDay());
}

/**
 * The next `count` training dates, starting with today if today is one.
 * Falls back to consecutive days when no schedule is set.
 */
export function upcomingTrainingDates(
  trainingDays: number[],
  fromIso: ISODate,
  count: number
): ISODate[] {
  const out: ISODate[] = [];
  if (count <= 0) return out;
  const days = trainingDays.length > 0 ? trainingDays : [0, 1, 2, 3, 4, 5, 6];
  const cursor = toDate(fromIso);
  // 8 weeks of lookahead is plenty for a 4-week cycle and bounds the loop
  for (let step = 0; step < 56 && out.length < count; step++) {
    if (days.includes(cursor.getDay())) out.push(toIso(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

/** Calendar date of the Nth upcoming session (1 = the next one, today included). */
export function dateOfUpcomingSession(
  trainingDays: number[],
  fromIso: ISODate,
  sessionsAhead: number
): ISODate | null {
  if (sessionsAhead < 1) return null;
  const dates = upcomingTrainingDates(trainingDays, fromIso, sessionsAhead);
  return dates.length === sessionsAhead ? dates[sessionsAhead - 1] : null;
}

/** How many sessions into the 4-week cycle you are (0 = nothing done yet). */
export function sessionsCompletedInCycle(week: number, sessionInWeek: number): number {
  return (week - 1) * 3 + (sessionInWeek - 1);
}

/**
 * When the next deload and test land, as real dates.
 * Deload = week 4 session 1; test = week 4 session 3.
 */
export function cycleMilestoneDates(
  trainingDays: number[],
  todayIso: ISODate,
  week: number,
  sessionInWeek: number
): { deload: ISODate | null; test: ISODate | null; sessionsToDeload: number } {
  const done = sessionsCompletedInCycle(week, sessionInWeek);
  const sessionsToDeload = 10 - done; // week 4 session 1 is the 10th session of the cycle
  const sessionsToTest = 12 - done; // week 4 session 3
  return {
    deload: dateOfUpcomingSession(trainingDays, todayIso, sessionsToDeload),
    test: dateOfUpcomingSession(trainingDays, todayIso, sessionsToTest),
    sessionsToDeload,
  };
}

/** Training days that have gone by since a date — i.e. sessions missed. */
export function missedTrainingDays(
  trainingDays: number[],
  sinceIso: ISODate,
  todayIso: ISODate
): number {
  const from = toDate(sinceIso);
  const to = toDate(todayIso);
  if (to <= from) return 0;
  const days = trainingDays.length > 0 ? trainingDays : [0, 1, 2, 3, 4, 5, 6];
  let missed = 0;
  const cursor = new Date(from);
  cursor.setDate(cursor.getDate() + 1); // the day trained doesn't count as missed
  const span = Math.min(370, Math.round((to.getTime() - from.getTime()) / MS_PER_DAY));
  for (let i = 0; i < span; i++) {
    if (days.includes(cursor.getDay())) missed += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return missed;
}

/** "Mon, Aug 17" — short, human, no year unless it differs from today's. */
export function fmtScheduleDate(iso: ISODate, todayIso: ISODate): string {
  const d = toDate(iso);
  const sameYear = d.getFullYear() === toDate(todayIso).getFullYear();
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/** "10×11" for a uniform day, "10 × 9–11" when grip blocks differ. */
export function setsRepsLabel(sets: Array<{ targetReps: number; amrap?: boolean }>): string {
  if (sets.length === 0) return '—';
  const reps = sets.map((s) => s.targetReps);
  const lo = Math.min(...reps);
  const hi = Math.max(...reps);
  const amrap = sets[0].amrap ? '+' : '';
  return lo === hi ? `${sets.length}×${lo}${amrap}` : `${sets.length} × ${lo}–${hi}`;
}
