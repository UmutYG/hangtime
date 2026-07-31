import { describe, expect, it } from 'vitest';
import {
  bodyCards,
  countDays,
  defaultStack,
  genericCard,
  kindCard,
  MECH_INFO,
  newSupplementId,
  nowWindow,
  stripData,
  supDayFor,
  toggleTaken,
} from '../supplements';
import type { SupplementDay, SupplementItem } from '../types';

const TODAY = '2026-07-31';

function daysTaking(itemId: string, dates: string[]): SupplementDay[] {
  return dates.map((date) => ({ date, taken: { [itemId]: '08:00' } }));
}

/** n consecutive days ending today */
function lastNDays(itemId: string, n: number): SupplementDay[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(TODAY + 'T12:00:00');
    d.setDate(d.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return daysTaking(itemId, out);
}

describe('default stack', () => {
  it('ships the 8-item protocol with unique ids and valid mechs', () => {
    const stack = defaultStack();
    expect(stack).toHaveLength(8);
    expect(new Set(stack.map((i) => i.id)).size).toBe(8);
    for (const item of stack) {
      expect(Object.keys(MECH_INFO)).toContain(item.mech);
      expect(item.active).toBe(true);
    }
    // the five rich panels are wired to their items
    expect(stack.find((i) => i.id === 'creatine')?.kind).toBe('creatine');
    expect(stack.find((i) => i.id === 'omega')?.kind).toBe('omega');
    expect(stack.find((i) => i.id === 'mag_pm')?.kind).toBe('magPm');
    expect(stack.find((i) => i.id === 'zinc')?.kind).toBe('zinc');
    expect(stack.find((i) => i.id === 'd3k2')?.kind).toBe('d3');
  });
});

describe('toggleTaken', () => {
  it('logs and unlogs, dropping empty days', () => {
    let days: SupplementDay[] = [];
    days = toggleTaken(days, TODAY, 'creatine', '19:12');
    expect(supDayFor(days, TODAY).taken.creatine).toBe('19:12');
    days = toggleTaken(days, TODAY, 'creatine', '19:15');
    expect(days).toHaveLength(0); // day removed when nothing is left
  });

  it('keeps other items on the same day intact', () => {
    let days: SupplementDay[] = [];
    days = toggleTaken(days, TODAY, 'omega', '13:00');
    days = toggleTaken(days, TODAY, 'zinc', '13:01');
    days = toggleTaken(days, TODAY, 'omega', '13:05');
    expect(supDayFor(days, TODAY).taken).toEqual({ zinc: '13:01' });
  });
});

describe('countDays', () => {
  it('counts only days inside the trailing window', () => {
    const days = daysTaking('creatine', ['2026-07-31', '2026-07-30', '2026-07-04', '2026-06-01']);
    // 28-day window = 2026-07-04..07-31 inclusive
    expect(countDays(days, 'creatine', 28, TODAY)).toBe(3);
    expect(countDays(days, 'creatine', null, TODAY)).toBe(4);
  });

  it('ignores other items and future days', () => {
    const days: SupplementDay[] = [
      { date: '2026-07-30', taken: { omega: '12:00' } },
      { date: '2026-08-02', taken: { creatine: '19:00' } },
    ];
    expect(countDays(days, 'creatine', 28, TODAY)).toBe(0);
  });
});

describe('creatine stage boundaries', () => {
  const item = defaultStack().find((i) => i.id === 'creatine')!;
  const stageAt = (n: number) => kindCard('creatine', item, lastNDays('creatine', n), TODAY).stage;

  it('walks the saturation clock', () => {
    expect(stageAt(0)).toBe('not started');
    expect(stageAt(6)).toBe('filling');
    expect(stageAt(7)).toBe('climbing');
    expect(stageAt(13)).toBe('climbing');
    expect(stageAt(14)).toBe('approaching saturation');
    expect(stageAt(23)).toBe('approaching saturation');
    expect(stageAt(24)).toBe('saturated');
    expect(stageAt(28)).toBe('saturated');
  });

  it('caps the bar at 100', () => {
    const card = kindCard('creatine', item, lastNDays('creatine', 28), TODAY);
    expect(card.pct).toBe(100);
  });
});

describe('other kind stages', () => {
  const stack = defaultStack();
  it('omega: incorporating → building → steady state', () => {
    const item = stack.find((i) => i.id === 'omega')!;
    expect(kindCard('omega', item, lastNDays('omega', 29), TODAY).stage).toBe('incorporating');
    expect(kindCard('omega', item, lastNDays('omega', 30), TODAY).stage).toBe('building');
    expect(kindCard('omega', item, lastNDays('omega', 90), TODAY).stage).toBe('steady state');
  });
  it('magPm: readable at 7 of 14 nights', () => {
    const item = stack.find((i) => i.id === 'mag_pm')!;
    expect(kindCard('magPm', item, lastNDays('mag_pm', 6), TODAY).stage).toBe('too early to read');
    expect(kindCard('magPm', item, lastNDays('mag_pm', 7), TODAY).stage).toBe('readable');
  });
  it('zinc: conditional once anything is logged; d3 always says retest', () => {
    const zinc = stack.find((i) => i.id === 'zinc')!;
    expect(kindCard('zinc', zinc, [], TODAY).stage).toBe('not taken');
    expect(kindCard('zinc', zinc, lastNDays('zinc', 1), TODAY).stage).toBe('conditional');
    const d3 = stack.find((i) => i.id === 'd3k2')!;
    expect(kindCard('d3', d3, lastNDays('d3k2', 10), TODAY).stage).toBe('retest due');
    expect(kindCard('d3', d3, lastNDays('d3k2', 10), TODAY).pct).toBeNull();
  });
});

describe('bodyCards', () => {
  it('gives kind items rich cards and custom items generic ones, hiding never-logged archived items', () => {
    const custom: SupplementItem = {
      id: 'custom_1',
      name: 'Probiotic',
      slot: 'Dinner',
      mech: 'food',
      active: true,
      order: 8,
    };
    const archivedUnlogged: SupplementItem = { ...custom, id: 'custom_2', name: 'Old', active: false, order: 9 };
    const items = [...defaultStack(), custom, archivedUnlogged];
    const cards = bodyCards(items, lastNDays('custom_1', 5), TODAY);
    expect(cards.find((c) => c.itemId === 'custom_1')?.stage).toBe('5 of 28 days');
    expect(cards.find((c) => c.itemId === 'custom_2')).toBeUndefined();
    expect(cards.find((c) => c.itemId === 'creatine')?.title).toBe('Creatine saturation');
  });

  it('keeps an archived item with recent history visible', () => {
    const archived: SupplementItem = {
      id: 'custom_1',
      name: 'Probiotic',
      slot: 'Dinner',
      mech: 'food',
      active: false,
      order: 8,
    };
    const cards = bodyCards([archived], lastNDays('custom_1', 3), TODAY);
    expect(cards).toHaveLength(1);
  });

  it('generic card reads not-started at zero days', () => {
    const custom: SupplementItem = {
      id: 'x',
      name: 'X',
      slot: '',
      mech: 'food',
      active: true,
      order: 0,
    };
    expect(genericCard(custom, [], TODAY).stage).toBe('not started');
  });
});

describe('stripData', () => {
  it('builds 14 bars ending today with the right totals', () => {
    const { bars, legend } = stripData(lastNDays('omega', 3), 8, TODAY);
    expect(bars).toHaveLength(14);
    expect(bars[13].date).toBe(TODAY);
    expect(bars[13].isToday).toBe(true);
    expect(bars[13].taken).toBe(1);
    expect(bars[10].taken).toBe(0);
    expect(legend).toBe('3 doses across 3 days');
  });

  it('handles an empty log and zero items without dividing by zero', () => {
    const { bars, legend } = stripData([], 0, TODAY);
    expect(bars.every((b) => b.pct === 0)).toBe(true);
    expect(legend).toBe('Nothing logged in this window yet.');
  });
});

describe('nowWindow', () => {
  it('maps hours to the day rhythm, inclusive at starts', () => {
    expect(nowWindow(0).state).toBe('Asleep, ideally.');
    expect(nowWindow(6).state).toContain('Clear window');
    expect(nowWindow(6.41).state).toContain('Clear window');
    expect(nowWindow(6.42).state).toContain('coconut oil');
    expect(nowWindow(12).state).toContain('First meal');
    expect(nowWindow(19.5).state).toContain('creatine');
    expect(nowWindow(23.99).state).toContain('magnesium before bed');
  });
  it('clamps out-of-range hours instead of failing', () => {
    expect(nowWindow(24).state).toContain('magnesium before bed');
    expect(nowWindow(-1).state).toBe('Asleep, ideally.');
  });
});

describe('newSupplementId', () => {
  it('never collides with existing ids', () => {
    const stack = defaultStack();
    const id1 = newSupplementId(stack);
    expect(stack.some((i) => i.id === id1)).toBe(false);
    const withCustom = [...stack, { ...stack[0], id: 'custom_9' }];
    expect(withCustom.some((i) => i.id === newSupplementId(withCustom))).toBe(false);
  });
});
