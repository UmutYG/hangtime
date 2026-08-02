import { describe, expect, it } from 'vitest';
import { absorptionNote, minutesBetween, todayLine } from '../absorption';
import { defaultStack } from '../supplements';
import type { SupplementDay, SupplementItem, SupplementMech } from '../types';

const stack = defaultStack();
const byId = (id: string) => stack.find((i) => i.id === id)!;
const emptyDay = (date = '2026-08-01'): SupplementDay => ({ date, taken: {} });

describe('minutesBetween', () => {
  it('measures the gap either way round', () => {
    expect(minutesBetween('12:30', '14:00')).toBe(90);
    expect(minutesBetween('14:00', '12:30')).toBe(90);
  });
  it('returns null on anything it cannot read', () => {
    expect(minutesBetween('noon', '12:00')).toBeNull();
  });
});

describe('absorptionNote — context decides the outcome', () => {
  it('describes a fat-soluble dose differently for each route', () => {
    const omega = byId('omega');
    const day = emptyDay();
    expect(absorptionNote(omega, 'fat', '12:30', day, stack).landing).toBe('full');
    expect(absorptionNote(omega, 'food', '12:30', day, stack).landing).toBe('partial');
    expect(absorptionNote(omega, 'empty', '12:30', day, stack).landing).toBe('little');
  });

  it('creatine needs the meal, not the fat', () => {
    const creatine = byId('creatine');
    const day = emptyDay();
    expect(absorptionNote(creatine, 'food', '19:00', day, stack).landing).toBe('full');
    expect(absorptionNote(creatine, 'empty', '19:00', day, stack).landing).toBe('partial');
  });

  it('a mineral lands fully whichever way it goes down — only the pace changes', () => {
    const mag = byId('mag_am');
    const day = emptyDay();
    for (const ctx of ['empty', 'food', 'fat'] as const) {
      expect(absorptionNote(mag, ctx, '06:00', day, stack).landing).toBe('full');
    }
  });

  it('still answers honestly when the context was never given', () => {
    const note = absorptionNote(byId('d3k2'), null, '12:30', emptyDay(), stack);
    expect(note.body.length).toBeGreaterThan(20);
    expect(note.landing).toBe('full');
  });
});

describe('absorptionNote — the one interaction that matters', () => {
  it('mentions a mineral taken within two hours', () => {
    const day: SupplementDay = { date: '2026-08-01', taken: { mag_am: '11:30', zinc: '12:30' } };
    const note = absorptionNote(byId('zinc'), 'food', '12:30', day, stack);
    expect(note.aside).toContain('Magnesium AM');
    expect(note.aside).toContain('queue');
  });

  it('says nothing when the minerals are far enough apart', () => {
    const day: SupplementDay = { date: '2026-08-01', taken: { mag_am: '06:00', zinc: '12:30' } };
    expect(absorptionNote(byId('zinc'), 'food', '12:30', day, stack).aside).toBeUndefined();
  });

  it('does not invent an interaction between things that do not compete', () => {
    const day: SupplementDay = { date: '2026-08-01', taken: { omega: '12:30', d3k2: '12:31' } };
    expect(absorptionNote(byId('omega'), 'fat', '12:30', day, stack).aside).toBeUndefined();
  });
});

describe('tone — describe, never scold', () => {
  const banned = /\bshould\b|\bmust\b|\bwrong\b|\bmistake\b|\bfail|\btoo late\b|!/i;

  it('never scolds, in any mechanism and any context', () => {
    const mechs: SupplementMech[] = ['fat', 'gate', 'clear', 'door', 'food'];
    for (const mech of mechs) {
      const item: SupplementItem = {
        id: 't',
        name: 'T',
        slot: '',
        mech,
        active: true,
        order: 0,
      };
      for (const ctx of ['empty', 'food', 'fat', null] as const) {
        const note = absorptionNote(item, ctx, '10:00', emptyDay(), [item]);
        expect(note.body, `${mech}/${ctx}`).not.toMatch(banned);
      }
    }
  });

  it('offers a way through when less of the dose lands', () => {
    const empty = absorptionNote(byId('omega'), 'empty', '09:00', emptyDay(), stack);
    expect(empty.landing).toBe('little');
    expect(empty.body).toMatch(/no harm/i);
  });
});

describe('todayLine — read the log, not the clock', () => {
  const items = stack;

  it('stays quiet and open before anything is logged', () => {
    const line = todayLine(items, emptyDay(), 9);
    expect(line.state).toBe('The day is open.');
    expect(line.why).not.toMatch(/should/i);
  });

  it('reports what happened and what is still open', () => {
    const day: SupplementDay = {
      date: '2026-08-01',
      taken: { mag_am: '06:00', omega: '12:30' },
      skipped: { coconut_am: '09:00' },
    };
    const line = todayLine(items, day, 14);
    expect(line.state).toBe('2 taken so far, 1 skipped.');
    expect(line.why).toMatch(/^Still open:/);
  });

  it('closes the day once everything has an answer, skips included', () => {
    const taken: Record<string, string> = {};
    for (const i of items) taken[i.id] = '10:00';
    const line = todayLine(items, { date: '2026-08-01', taken }, 22);
    expect(line.state).toBe('Everything answered today.');
  });

  it('counts a skipped day as answered, not as a gap', () => {
    const day: SupplementDay = { date: '2026-08-01', taken: {}, skipped: {} };
    for (const i of items) day.skipped![i.id] = '10:00';
    expect(todayLine(items, day, 22).state).toBe('Everything answered today.');
  });

  it('never asserts a routine the user did not follow', () => {
    const day: SupplementDay = { date: '2026-08-01', taken: { creatine: '11:00' } };
    const line = todayLine(items, day, 11);
    expect(`${line.state} ${line.why}`).not.toMatch(/fasted|first meal|dinner|before bed/i);
  });
});
