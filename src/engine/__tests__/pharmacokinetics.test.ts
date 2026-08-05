import { describe, expect, it } from 'vitest';
import {
  SITE_LABEL,
  elapsedLabel,
  journeyFor,
  parseClock,
  positionAt,
  sitesFor,
  type BodySite,
} from '../pharmacokinetics';
import { defaultStack } from '../supplements';
import type { SupplementContext, SupplementItem, SupplementMech } from '../types';

const MECHS: SupplementMech[] = ['fat', 'gate', 'clear', 'door', 'food'];
const CTXS: (SupplementContext | null)[] = [null, 'empty', 'food', 'fat'];

function item(over: Partial<SupplementItem> = {}): SupplementItem {
  return { id: 'x', name: 'X', slot: 'anytime', mech: 'clear', active: true, order: 0, ...over };
}

const stack = defaultStack();

describe('journeys are well formed', () => {
  const all: SupplementItem[] = [...stack, ...MECHS.map((mech) => item({ mech }))];

  it('every seeded item and every mechanism has a journey', () => {
    for (const it of all) expect(journeyFor(it, null).length).toBeGreaterThan(2);
  });

  it('phases are contiguous, ordered and end in a long arc', () => {
    for (const it of all) {
      for (const ctx of CTXS) {
        const ph = journeyFor(it, ctx);
        expect(ph[0].from).toBe(0);
        for (let i = 1; i < ph.length; i++) {
          expect(ph[i].from).toBe(ph[i - 1].to); // no gaps, no overlaps
          expect(ph[i].to).toBeGreaterThan(ph[i].from);
        }
        const last = ph[ph.length - 1];
        expect(last.longArc).toBe(true);
        expect(last.to).toBe(Infinity);
        // exactly one long arc, and it is the last
        expect(ph.filter((p) => p.longArc)).toHaveLength(1);
      }
    }
  });

  it('names every site it uses', () => {
    for (const it of all) {
      for (const s of sitesFor(it, null)) expect(SITE_LABEL[s as BodySite]).toBeTruthy();
    }
  });

  it('starts in the stomach — nothing skips being swallowed', () => {
    for (const it of all) expect(journeyFor(it, null)[0].site).toBe('stomach');
  });
});

describe('how it was taken moves the clock', () => {
  it('an empty stomach hands the dose on sooner than a fatty meal', () => {
    const it = item({ mech: 'clear' });
    const empty = journeyFor(it, 'empty')[0].to;
    const none = journeyFor(it, null)[0].to;
    const fatty = journeyFor(it, 'fat')[0].to;
    expect(empty).toBeLessThan(none);
    expect(fatty).toBeGreaterThan(none);
  });

  it('shifts the whole route rather than compressing it', () => {
    const it = item({ mech: 'clear' });
    const a = journeyFor(it, null);
    const b = journeyFor(it, 'food');
    const shift = b[0].to - a[0].to;
    expect(shift).toBeGreaterThan(0);
    // downstream phases keep their own durations, just start later
    for (let i = 1; i < a.length - 1; i++) {
      expect(b[i].from).toBe(a[i].from + shift);
      expect(b[i].to - b[i].from).toBe(a[i].to - a[i].from);
    }
  });

  it('treats a fatty meal as the normal route for a fat-soluble dose', () => {
    // fat-solubles need the fat; the handoff is slow but it is not a penalty
    // on top of what "with food" already costs the others
    const fatSol = journeyFor(item({ mech: 'fat' }), 'fat')[0].to;
    const mineral = journeyFor(item({ mech: 'clear' }), 'fat')[0].to;
    expect(fatSol / journeyFor(item({ mech: 'fat' }), null)[0].to).toBeLessThan(
      mineral / journeyFor(item({ mech: 'clear' }), null)[0].to
    );
  });
});

describe('positionAt', () => {
  const creatine = stack.find((i) => i.kind === 'creatine')!;

  it('walks the route as the day goes on', () => {
    const at = '19:00';
    const seen = [0, 30, 90, 180, 600].map(
      (m) => positionAt(creatine, null, at, 19 * 60 + m)!.phase.site
    );
    expect(seen[0]).toBe('stomach');
    expect(seen[seen.length - 1]).toBe('muscle');
    // never goes backwards
    const order = journeyFor(creatine, null).map((p) => p.site);
    let cursor = -1;
    for (const s of seen) {
      const at2 = order.indexOf(s, cursor === -1 ? 0 : cursor);
      expect(at2).toBeGreaterThanOrEqual(cursor);
      cursor = at2;
    }
  });

  it('reports progress inside the phase, clamped to 0–1', () => {
    for (const m of [0, 5, 13, 40, 200, 5000]) {
      const p = positionAt(creatine, null, '08:00', 8 * 60 + m)!;
      expect(p.progress).toBeGreaterThanOrEqual(0);
      expect(p.progress).toBeLessThanOrEqual(1);
    }
  });

  it('settles in the long arc and stays there', () => {
    const a = positionAt(creatine, null, '08:00', 8 * 60 + 10_000)!;
    const b = positionAt(creatine, null, '08:00', 8 * 60 + 90_000)!;
    expect(a.phase.longArc).toBe(true);
    expect(b.phase).toEqual(a.phase);
    expect(b.progress).toBe(1);
  });

  it('carries a dose from a previous day forward, not backward', () => {
    const yest = positionAt(creatine, null, '19:00', 9 * 60, 1)!;
    expect(yest.elapsed).toBeGreaterThan(0);
    expect(yest.phase.longArc).toBe(true);
  });

  it('says nothing when there is no readable time', () => {
    // a back-filled dose with no time recorded must not be given a position
    expect(positionAt(creatine, null, '', 600)).toBeNull();
    expect(positionAt(creatine, null, 'later', 600)).toBeNull();
    expect(positionAt(creatine, null, '99:99', 600)).toBeNull();
  });

  it('says nothing about a dose logged for later than now', () => {
    expect(positionAt(creatine, null, '22:00', 9 * 60)).toBeNull();
  });
});

describe('parseClock', () => {
  it('reads valid stamps and rejects the rest', () => {
    expect(parseClock('00:00')).toBe(0);
    expect(parseClock('9:05')).toBe(545);
    expect(parseClock('23:59')).toBe(1439);
    expect(parseClock('24:00')).toBeNull();
    expect(parseClock('12:60')).toBeNull();
    expect(parseClock('')).toBeNull();
  });
});

describe('elapsedLabel', () => {
  it('reads naturally at every scale', () => {
    expect(elapsedLabel(0)).toBe('just now');
    expect(elapsedLabel(25)).toBe('25 min ago');
    expect(elapsedLabel(60)).toBe('1h ago');
    expect(elapsedLabel(135)).toBe('2h 15m ago');
    expect(elapsedLabel(1440)).toBe('yesterday');
    expect(elapsedLabel(1440 * 3)).toBe('3 days ago');
  });
});

describe('tone', () => {
  // Same guard as absorption.ts: this describes a body, it never grades a
  // choice. A dose that lands slowly is information, not a mistake.
  const banned = /\bshould\b|\bmust\b|\bwrong\b|\bmistake\b|\bfail|\btoo late\b|\bbad\b|!/i;

  it('never scolds, in any journey', () => {
    const all = [...stack, ...MECHS.map((mech) => item({ mech }))];
    for (const it of all) {
      for (const ctx of CTXS) {
        for (const p of journeyFor(it, ctx)) {
          expect(p.body, `${it.name}/${ctx}: ${p.body}`).not.toMatch(banned);
          expect(p.label).not.toMatch(banned);
        }
      }
    }
  });

  it('keeps captions short enough to read on a figure', () => {
    for (const it of [...stack, ...MECHS.map((mech) => item({ mech }))]) {
      for (const p of journeyFor(it, null)) expect(p.label.length).toBeLessThanOrEqual(22);
    }
  });
});
