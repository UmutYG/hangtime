// What is actually happening to a dose — pure functions, no RN imports.
//
// The old copy was written for an ideal day: magnesium "absorbing on an empty
// gut" is simply untrue if it went down after a fatty lunch. This reads the
// real conditions instead — how it was taken, when, and what else was near it —
// and describes them.
//
// Tone rule, deliberately enforced by a test: describe, never scold. A dose
// taken in a way that absorbs less is worth knowing about, and is never a
// failure. There is always a version of the day that still works.

import { MECH_INFO } from './supplements';
import type {
  ISODate,
  SupplementContext,
  SupplementDay,
  SupplementItem,
  SupplementMech,
} from './types';

export interface AbsorptionNote {
  /** one line of what is happening, in the body, now */
  body: string;
  /** an optional second line: an interaction worth knowing about */
  aside?: string;
  /**
   * How much of the dose this route delivers. Used only to pick the
   * illustration's fill — never shown as a score, never called good or bad.
   */
  landing: 'full' | 'partial' | 'little';
}

/** minutes between two "HH:MM" stamps, or null if either is unparseable */
export function minutesBetween(a: string, b: string): number | null {
  const m = (s: string) => {
    const x = /^(\d{1,2}):(\d{2})/.exec(s);
    return x ? Number(x[1]) * 60 + Number(x[2]) : null;
  };
  const ma = m(a);
  const mb = m(b);
  if (ma === null || mb === null) return null;
  return Math.abs(ma - mb);
}

/** the minerals that queue at the same transporters */
function competesForGate(mech: SupplementMech): boolean {
  return mech === 'gate' || mech === 'clear';
}

/**
 * Anything taken close enough to this dose to matter. Only mineral-on-mineral
 * is reported — it is the one interaction in this stack with a real effect.
 */
function gateNeighbour(
  item: SupplementItem,
  at: string,
  day: SupplementDay,
  items: SupplementItem[]
): SupplementItem | null {
  if (!competesForGate(item.mech)) return null;
  for (const [otherId, otherAt] of Object.entries(day.taken)) {
    if (otherId === item.id) continue;
    const other = items.find((i) => i.id === otherId);
    if (!other || !competesForGate(other.mech)) continue;
    const gap = minutesBetween(at, otherAt);
    if (gap !== null && gap <= 120) return other;
  }
  return null;
}

const UNKNOWN: Record<SupplementMech, string> = {
  fat: 'Fat-soluble, so how much of this lands depends entirely on whether there was fat alongside it.',
  gate: 'A mineral, so its pace depends on what else was in your stomach and how close the last one was.',
  clear: 'A mineral — it moves fastest through an empty stomach and more slowly behind a meal.',
  door: 'Getting this into blood is easy; getting it from blood into the cell is the step that needs a meal.',
  food: "It's food. Nothing to time it around.",
};

const BY_CONTEXT: Record<
  SupplementMech,
  Record<SupplementContext, { body: string; landing: AbsorptionNote['landing'] }>
> = {
  fat: {
    fat: {
      body: 'Being packaged into fat droplets right now — this is the route that actually carries it across the gut wall. Close to all of this dose lands.',
      landing: 'full',
    },
    food: {
      body: 'A normal meal carries some fat, so part of this is being packaged and the rest waits. A decent share lands — less than with a properly fatty meal, more than none.',
      landing: 'partial',
    },
    empty: {
      body: 'Nothing here for it to ride on, so only a small fraction crosses. The rest simply passes through — no harm, it just means today\'s dose is smaller than it looks.',
      landing: 'little',
    },
  },
  gate: {
    fat: {
      body: 'Fat slows how fast your stomach hands anything onward, so this is arriving gradually rather than in a wave. All of it still gets there.',
      landing: 'full',
    },
    food: {
      body: 'Food alongside is what keeps this from turning your stomach, and the mineral still gets where it\'s going. This is the comfortable way to take it.',
      landing: 'full',
    },
    empty: {
      body: 'Absorbing quickly with nothing in the way. On an empty stomach this one can sit heavily after twenty minutes or so — worth noticing whether it does for you.',
      landing: 'full',
    },
  },
  clear: {
    fat: {
      body: 'Fat is slowing the belt, so this is trickling through rather than moving fast. It all still arrives — just later than it would have.',
      landing: 'full',
    },
    food: {
      body: 'Behind a meal it moves slower than on an empty stomach, which changes the timing rather than the amount. Effectively all of it lands.',
      landing: 'full',
    },
    empty: {
      body: 'Nothing in the way and nothing slowing the belt — this is the fastest route this mineral gets.',
      landing: 'full',
    },
  },
  door: {
    fat: {
      body: 'Fat alone barely moves insulin, so this is sitting in the blood waiting for the transporter to open. It still counts toward saturation — the timing just stretches.',
      landing: 'partial',
    },
    food: {
      body: "The meal's insulin response is opening the muscle transporter now, which is the step that actually gets this into the cell.",
      landing: 'full',
    },
    empty: {
      body: 'This gets into your blood easily enough; without a meal the door into the muscle opens more slowly. Saturation is cumulative, so a day like this still adds up.',
      landing: 'partial',
    },
  },
  food: {
    fat: { body: 'This is the fat. Nothing to time, nothing to optimise.', landing: 'full' },
    food: { body: 'Going down with the meal, which is all it ever needed to do.', landing: 'full' },
    empty: {
      body: 'On its own, it is simply fat arriving. It can double as the raft if you take something fat-soluble in the next while.',
      landing: 'full',
    },
  },
};

/**
 * The line shown after logging a dose.
 *
 * `ctx` is optional on purpose — a rushed log still gets an honest, general
 * answer, and saying how you took it only sharpens it.
 */
export function absorptionNote(
  item: SupplementItem,
  ctx: SupplementContext | null,
  at: string,
  day: SupplementDay,
  items: SupplementItem[]
): AbsorptionNote {
  const base = ctx
    ? BY_CONTEXT[item.mech][ctx]
    : { body: UNKNOWN[item.mech], landing: 'full' as const };

  const note: AbsorptionNote = { body: base.body, landing: base.landing };

  const neighbour = gateNeighbour(item, at, day, items);
  if (neighbour) {
    note.aside = `${neighbour.name} went in around the same time — these two share transporters, so they queue rather than block each other. Both still arrive, just slower.`;
    if (note.landing === 'full') note.landing = 'partial';
  }

  return note;
}

/** the mechanism's own name, for the popup's heading */
export function mechName(mech: SupplementMech): string {
  return MECH_INFO[mech].name;
}

// ---------- the day, as it actually went ----------

export interface TodayLine {
  state: string;
  why: string;
}

/**
 * What today looks like, read from the log rather than the clock.
 *
 * The clock-driven version asserted a weekday routine and was simply wrong on
 * a Saturday — it told him what he should be doing while he was doing
 * something else. This describes what happened and what is still open, which
 * is true on every kind of day.
 */
export function todayLine(
  items: SupplementItem[],
  day: SupplementDay,
  hourFloat: number
): TodayLine {
  const active = items.filter((i) => i.active);
  const taken = active.filter((i) => day.taken[i.id]);
  const skipped = active.filter((i) => day.skipped?.[i.id]);
  const open = active.filter((i) => !day.taken[i.id] && !day.skipped?.[i.id]);

  if (active.length === 0) {
    return { state: 'Nothing in the stack yet.', why: 'Add what you take under Stack.' };
  }

  if (taken.length === 0 && skipped.length === 0) {
    return {
      state: hourFloat < 11 ? 'The day is open.' : 'Nothing logged yet today.',
      why: 'Whenever you get to them is when they happen.',
    };
  }

  if (open.length === 0) {
    return {
      state: 'Everything answered today.',
      why:
        skipped.length > 0
          ? `${taken.length} taken, ${skipped.length} skipped — a complete picture of the day either way.`
          : 'The whole stack, logged.',
    };
  }

  const names = open.slice(0, 2).map((i) => i.name);
  const more = open.length - names.length;
  const openList =
    more > 0
      ? `${names.join(', ')} and ${more} more`
      : names.length === 2
        ? `${names[0]} and ${names[1]}`
        : names[0];

  return {
    state: `${taken.length} taken so far${skipped.length ? `, ${skipped.length} skipped` : ''}.`,
    why: `Still open: ${openList}.`,
  };
}
