import { describe, expect, it } from 'vitest';
import {
  cycleMilestoneDates,
  dateOfUpcomingSession,
  isTrainingDay,
  missedTrainingDays,
  sessionsCompletedInCycle,
  upcomingTrainingDates,
} from '../schedule';

// Mon/Wed/Fri = 1/3/5. 2026-07-27 is a Monday.
const MWF = [1, 3, 5];
const MON = '2026-07-27';

describe('training-day awareness', () => {
  it('knows which days are training days', () => {
    expect(isTrainingDay(MWF, MON)).toBe(true); // Monday
    expect(isTrainingDay(MWF, '2026-07-28')).toBe(false); // Tuesday
    expect(isTrainingDay(MWF, '2026-07-29')).toBe(true); // Wednesday
    expect(isTrainingDay(MWF, '2026-08-01')).toBe(false); // Saturday
  });

  it('treats every day as fair game when no schedule is set', () => {
    expect(isTrainingDay([], '2026-07-28')).toBe(true);
  });
});

describe('upcoming training dates', () => {
  it('starts with today when today is a training day', () => {
    expect(upcomingTrainingDates(MWF, MON, 4)).toEqual([
      '2026-07-27', // Mon
      '2026-07-29', // Wed
      '2026-07-31', // Fri
      '2026-08-03', // Mon
    ]);
  });

  it('skips ahead when today is a rest day', () => {
    expect(upcomingTrainingDates(MWF, '2026-07-28', 2)).toEqual(['2026-07-29', '2026-07-31']);
  });

  it('falls back to consecutive days with no schedule', () => {
    expect(upcomingTrainingDates([], MON, 3)).toEqual(['2026-07-27', '2026-07-28', '2026-07-29']);
  });

  it('returns nothing for a non-positive count', () => {
    expect(upcomingTrainingDates(MWF, MON, 0)).toEqual([]);
    expect(dateOfUpcomingSession(MWF, MON, 0)).toBeNull();
  });
});

describe('cycle position maths', () => {
  it('counts sessions completed in the cycle', () => {
    expect(sessionsCompletedInCycle(1, 1)).toBe(0);
    expect(sessionsCompletedInCycle(1, 2)).toBe(1);
    expect(sessionsCompletedInCycle(2, 1)).toBe(3);
    expect(sessionsCompletedInCycle(4, 1)).toBe(9); // deload starts here
    expect(sessionsCompletedInCycle(4, 3)).toBe(11); // test day
  });
});

describe('deload and test dates', () => {
  it('projects the deload onto a real training day three weeks out', () => {
    const m = cycleMilestoneDates(MWF, MON, 1, 1);
    expect(m.sessionsToDeload).toBe(10);
    // 10th session from Mon 27 Jul on a Mon/Wed/Fri schedule
    expect(m.deload).toBe('2026-08-17');
    expect(isTrainingDay(MWF, m.deload!)).toBe(true);
    expect(m.test).toBe('2026-08-21');
  });

  it('moves closer as the cycle advances', () => {
    const early = cycleMilestoneDates(MWF, MON, 1, 1);
    const later = cycleMilestoneDates(MWF, MON, 3, 2);
    expect(later.sessionsToDeload).toBeLessThan(early.sessionsToDeload);
    expect(later.deload! < early.deload!).toBe(true);
  });

  it('says the deload is now once week 4 starts', () => {
    const m = cycleMilestoneDates(MWF, MON, 4, 1);
    expect(m.sessionsToDeload).toBe(1); // today's session IS the deload
  });

  it('reports a real date rather than a session count when no schedule exists', () => {
    const m = cycleMilestoneDates([], MON, 1, 1);
    expect(m.deload).toBe('2026-08-05'); // 10 consecutive days
  });
});

describe('missed sessions', () => {
  it('counts training days gone by, not raw days', () => {
    // trained Mon 27 Jul, now Mon 3 Aug: Wed 29, Fri 31 missed (today not yet missed)
    expect(missedTrainingDays(MWF, MON, '2026-08-03')).toBe(3);
    expect(missedTrainingDays(MWF, MON, '2026-07-29')).toBe(1); // just Wed
    expect(missedTrainingDays(MWF, MON, '2026-07-28')).toBe(0); // nothing scheduled yet
  });

  it('is zero for today or the past', () => {
    expect(missedTrainingDays(MWF, MON, MON)).toBe(0);
    expect(missedTrainingDays(MWF, MON, '2026-07-20')).toBe(0);
  });

  it('does not run away on a very old date', () => {
    expect(missedTrainingDays(MWF, '2020-01-01', MON)).toBeLessThanOrEqual(370);
  });
});
