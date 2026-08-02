// Supplement module — ported from the Protocol PWA. Pure functions, no RN imports.
// The organizing idea: every supplement is governed by one of five absorption
// mechanisms, and its place in the day follows from that mechanism, not from habit.

import type {
  ISODate,
  SupplementDay,
  SupplementItem,
  SupplementKind,
  SupplementContext,
  SupplementMech,
  SupplementStatus,
} from './types';

export const MECH_INFO: Record<SupplementMech, { tag: string; name: string; blurb: string }> = {
  fat: {
    tag: 'fat raft',
    name: 'Fat raft',
    blurb:
      "Fat-soluble compounds can't cross the gut wall alone — they're packaged into fat droplets first. No fat in the meal means few rafts, so the dose is largely wasted regardless of size. D, K, E, A, omega-3, CoQ10, curcumin.",
  },
  gate: {
    tag: 'shared gate',
    name: 'Shared gate',
    blurb:
      'Magnesium, zinc, calcium, iron and copper move through overlapping transporters. Arrive together in real doses and they queue — neither blocked, both slower. Two hours apart clears it.',
  },
  clear: {
    tag: 'clear window',
    name: 'Clear window',
    blurb:
      'Separate from the gate: fat slows how fast your stomach hands anything onward. A mineral riding with fat is delayed even with nothing competing for its transporter. An empty gut is the fastest belt.',
  },
  door: {
    tag: 'insulin door',
    name: 'Insulin door',
    blurb:
      'Some things absorb into blood easily but need help getting from blood into the cell. Insulin opens that transporter, so a meal with carbs or protein does the last-mile delivery. Day of week is irrelevant; presence of a meal isn\'t.',
  },
  food: {
    tag: 'just food',
    name: 'Just food',
    blurb:
      'No transporter, no ceiling, nothing to sequence around. Its only scheduling job is being present when something fat-soluble needs a raft.',
  },
};

/** Umut's stack as of the Protocol PWA (built from Vitafenix / Zinzino /
 *  Pure Encapsulations specs + the Synevo panel of 21.05.2026). Seeds the
 *  editable list — after seeding, the in-app editor owns it. */
export function defaultStack(): SupplementItem[] {
  return [
    {
      id: 'mag_am',
      name: 'Magnesium AM',
      slot: '06:00 · fasted, water',
      mech: 'clear',
      doing:
        'Absorbing on an empty gut — the fastest uptake window of your day. Keep fat out of it for about twenty more minutes.',
      why: 'Malate and citrate absorb by active transport, and at 6am nothing is in the way — no fat slowing the belt, no zinc queueing at the same gate. This is the cleanest absorption moment of your day, which is why the mineral gets it and the oil doesn\'t.',
      notice:
        'Malate feeds the citric-acid cycle, so expect steady output rather than a lift — if you feel a kick, that\'s the espresso. The one signal worth acting on is loose stools, which points at the citrate fraction rather than magnesium itself.',
      active: true,
      order: 0,
      remindAt: '06:00',
    },
    {
      id: 'coconut_am',
      name: 'Coconut oil',
      slot: '06:25 · before you leave',
      mech: 'fat',
      doing:
        'Gastric emptying is slowing now, which is fine — the capsule has already moved through ahead of it.',
      why: 'Home is the only place you have it, so the window is 6:00–7:00. At 6:25 it sits about 25 minutes behind the capsule, late enough that the fat\'s slowing effect lands after the magnesium has moved on.',
      notice:
        'Steady satiety across the walk rather than a sharp cognitive shift. About half of coconut oil is lauric acid, which behaves like a long-chain fat; only 13–15% is the C8/C10 fraction behind the brain claims. Good fat either way.',
      active: true,
      order: 1,
      remindAt: '06:25',
    },
    {
      id: 'omega',
      name: 'Omega-3',
      slot: 'First meal · with fat',
      mech: 'fat',
      kind: 'omega',
      doing:
        'Being packaged into micelles by the meal fat right now. It also just added roughly 800 IU of vitamin D on its own.',
      why: 'Your first meal is the first fat of the day, so it\'s the first moment omega-3 can actually be absorbed. Taken fasted, most of it is wasted.',
      notice:
        'Fishy burps mean the oil has oxidised — a freshness signal, not sensitivity. Everything else is cumulative over months and won\'t be felt; HDL was 49 against an optimal above 60, so that\'s the readout on your next panel.',
      active: true,
      order: 2,
      remindAt: '12:30',
    },
    {
      id: 'd3k2',
      name: 'Vitamin D3 + K2',
      slot: 'First meal · dose under review',
      mech: 'fat',
      kind: 'd3',
      doing:
        'Riding the same rafts the omega-3 is already building. It accumulates rather than clearing — that\'s the whole reason the dose is under review.',
      why: 'Both are fat-soluble, so they use the micelles the omega-3 already needs. Same meal, same swallow — one fat source doing three jobs. There\'s no version of this that works fasted.',
      notice:
        'This is the item where the number matters more than the feeling. 111 ng/mL against a 30–100 reference, on a combined intake near 8,000 IU/day against a widely cited 4,000 ceiling. Retest 25-OH D and let that set the dose.',
      active: true,
      order: 3,
      remindAt: '12:30',
    },
    {
      id: 'zinc',
      name: 'Zinc picolinate',
      slot: 'First meal · 15 mg',
      mech: 'gate',
      kind: 'zinc',
      doing:
        'Six hours clear of the morning magnesium, so the transporter queue is empty. Food alongside is what keeps picolinate from causing nausea.',
      why: 'Zinc shares transporters with magnesium, so the midday meal puts it six hours after the morning capsule and well before the evening one — both gates clear.',
      notice:
        'Nothing acute, and that\'s expected. 109 µg/dL in a 70–120 range means you aren\'t deficient, so the honest rationale is replacing sweat and turnover losses as volume climbs — not raising testosterone, which only responds when a deficiency is corrected.',
      active: true,
      order: 4,
      remindAt: '12:30',
    },
    {
      id: 'creatine',
      name: 'Creatine',
      slot: 'Dinner · 5 g, every day',
      mech: 'door',
      kind: 'creatine',
      doing:
        'The meal\'s insulin response is opening the muscle transporter now — that\'s the step that actually gets it into the cell.',
      why: 'Getting creatine into blood is easy; getting it from blood into muscle needs insulin. Which day it is doesn\'t matter — saturation is the whole mechanism, so this is daily, rest days included.',
      notice:
        'Two to four weeks to saturate, with about a kilo of early scale weight that is intracellular water, not fat. On future bloodwork, serum creatinine drifting to 1.0–1.3 is benign turnover, not kidney strain — eGFR above 90 is the check, and yours is 117.',
      active: true,
      order: 5,
      remindAt: '19:00',
    },
    {
      id: 'coconut_pm',
      name: 'Coconut oil',
      slot: 'Dinner · with food',
      mech: 'food',
      doing:
        'Second fat of the day, with no absorption job to do — the midday meal already covered that.',
      why: 'Second of your daily one to two tablespoons. Nothing here needs it as a raft, so it\'s simply fat intake placed where it\'s convenient.',
      notice: 'Nothing to track beyond it counting as part of your daily fat.',
      active: true,
      order: 6,
      remindAt: '19:00',
    },
    {
      id: 'mag_pm',
      name: 'Magnesium PM',
      slot: 'Before bed',
      mech: 'clear',
      kind: 'magPm',
      doing:
        'Glycine and taurine are the calming part — that\'s the carrier doing the work, not the hour you took it.',
      why: 'Same mineral, different carrier, and the carrier is the point. Glycine and taurine are both calming compounds in their own right. Also ten hours clear of the zinc.',
      notice:
        'How fast you fall asleep and how often you surface, judged over one to two weeks rather than one night. Bisglycinate is the gentlest form on the gut, so if the morning capsule troubles you and this one doesn\'t, you\'ve isolated the citrate fraction.',
      active: true,
      order: 7,
      remindAt: '22:00',
    },
  ];
}

// ---------- day log helpers ----------

export function supDayFor(days: SupplementDay[], date: ISODate): SupplementDay {
  return days.find((d) => d.date === date) ?? { date, taken: {} };
}

/** what was recorded for this item today, if anything */
export function statusOf(day: SupplementDay, itemId: string): SupplementStatus | null {
  if (day.taken[itemId]) return 'taken';
  if (day.skipped?.[itemId]) return 'skipped';
  return null;
}

/**
 * Record a status for an item on a date, or clear it with `null`.
 *
 * Skipped is stored separately from taken and never counted as a dose — the
 * point is to tell "I decided not to" apart from "I haven't got to it", which
 * a single tick can't express.
 */
export function setStatus(
  days: SupplementDay[],
  date: ISODate,
  itemId: string,
  status: SupplementStatus | null,
  timeStr: string
): SupplementDay[] {
  const day = supDayFor(days, date);
  const taken = { ...day.taken };
  const skipped = { ...(day.skipped ?? {}) };
  const ctx = { ...(day.ctx ?? {}) };
  delete taken[itemId];
  delete skipped[itemId];
  // how it was taken belongs to a dose; clearing or skipping drops it
  if (status !== 'taken') delete ctx[itemId];
  if (status === 'taken') taken[itemId] = timeStr;
  if (status === 'skipped') skipped[itemId] = timeStr;

  const rest = days.filter((d) => d.date !== date);
  const empty = Object.keys(taken).length === 0 && Object.keys(skipped).length === 0;
  if (empty) return rest;
  const next: SupplementDay = { date, taken };
  if (Object.keys(skipped).length > 0) next.skipped = skipped;
  if (Object.keys(ctx).length > 0) next.ctx = ctx;
  return [...rest, next].sort((a, b) => a.date.localeCompare(b.date));
}

/** Record how a dose went down. Only meaningful on something already taken. */
export function setContext(
  days: SupplementDay[],
  date: ISODate,
  itemId: string,
  context: SupplementContext | null
): SupplementDay[] {
  const day = supDayFor(days, date);
  if (!day.taken[itemId]) return days;
  const ctx = { ...(day.ctx ?? {}) };
  if (context === null) delete ctx[itemId];
  else ctx[itemId] = context;
  const rest = days.filter((d) => d.date !== date);
  const next: SupplementDay = { date, taken: day.taken };
  if (day.skipped && Object.keys(day.skipped).length > 0) next.skipped = day.skipped;
  if (Object.keys(ctx).length > 0) next.ctx = ctx;
  return [...rest, next].sort((a, b) => a.date.localeCompare(b.date));
}

/** tap-through order for the row circle: nothing → taken → skipped → nothing */
export function nextStatus(current: SupplementStatus | null): SupplementStatus | null {
  if (current === null) return 'taken';
  if (current === 'taken') return 'skipped';
  return null;
}

/** days on which the item was taken, optionally limited to the trailing window */
export function countDays(
  days: SupplementDay[],
  itemId: string,
  windowDays: number | null,
  today: ISODate
): number {
  const cutoff = windowDays ? addDays(today, -(windowDays - 1)) : null;
  return days.filter((d) => d.taken[itemId] && (!cutoff || d.date >= cutoff) && d.date <= today)
    .length;
}

function addDays(iso: ISODate, delta: number): ISODate {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

// ---------- physiology panels ----------

export interface BodyCard {
  itemId: string;
  title: string;
  stage: string;
  /** 0–100, or null for cards that are a status rather than a progression */
  pct: number | null;
  body: string;
}

/** stage card for a seeded kind — the same day-count logic as the PWA's renderCards() */
export function kindCard(
  kind: SupplementKind,
  item: SupplementItem,
  days: SupplementDay[],
  today: ISODate
): BodyCard {
  if (kind === 'creatine') {
    const cr = countDays(days, item.id, 28, today);
    let stage: string, body: string;
    if (cr === 0) {
      stage = 'not started';
      body =
        'Log your first dose and this becomes a saturation clock. Muscle stores fill over 2–4 weeks of daily intake, then hold.';
    } else if (cr < 7) {
      stage = 'filling';
      body = `${cr} of the last 28 days. Stores are climbing from baseline. Nothing to feel yet, and any scale movement this early is water drawn into the muscle cell.`;
    } else if (cr < 14) {
      stage = 'climbing';
      body = `${cr} of the last 28 days. Roughly where intracellular water shows up as about a kilo on the scale. Not fat — expected, and it stays while you keep taking it.`;
    } else if (cr < 24) {
      stage = 'approaching saturation';
      body = `${cr} of the last 28 days. Close to full stores. This is the window where reps at a given load and recovery between sets become a fair readout.`;
    } else {
      stage = 'saturated';
      body = `${cr} of the last 28 days. Stores effectively full — from here it's maintenance, and 5 g daily holds it. More adds nothing.`;
    }
    return { itemId: item.id, title: 'Creatine saturation', stage, pct: (cr / 28) * 100, body };
  }
  if (kind === 'omega') {
    const om = countDays(days, item.id, null, today);
    let stage: string, body: string;
    if (om < 30) {
      stage = 'incorporating';
      body = `${om} day${om === 1 ? '' : 's'} logged. Omega-3 works by getting built into cell membranes, which takes months rather than days. Nothing here is felt — it's read off bloodwork.`;
    } else if (om < 90) {
      stage = 'building';
      body = `${om} days logged. Membrane incorporation well underway. Your HDL was 49 against an optimal above 60 — that's the number that answers whether this is working.`;
    } else {
      stage = 'steady state';
      body = `${om} days logged. Past the point where levels plateau. A lipid panel now would be a fair test rather than a snapshot mid-build.`;
    }
    return {
      itemId: item.id,
      title: 'Omega-3 incorporation',
      stage,
      pct: Math.min(100, (om / 90) * 100),
      body,
    };
  }
  if (kind === 'magPm') {
    const mp = countDays(days, item.id, 14, today);
    const readable = mp >= 7;
    return {
      itemId: item.id,
      title: 'Magnesium, evening',
      stage: readable ? 'readable' : 'too early to read',
      pct: (mp / 14) * 100,
      body: readable
        ? `${mp} of the last 14 nights. Enough nights that how you're sleeping is a fair readout. If two readable weeks feel no different, that's real information about whether the PM capsule earns its place.`
        : `${mp} of the last 14 nights. Magnesium sleep effects need about a week of nights before a pattern means anything — one good or bad night is noise.`,
    };
  }
  if (kind === 'zinc') {
    const zn = countDays(days, item.id, 28, today);
    return {
      itemId: item.id,
      title: 'Zinc',
      stage: zn > 0 ? 'conditional' : 'not taken',
      pct: null,
      body: `${zn} of the last 28 days. Still the conditional item: 109 µg/dL means you weren't deficient, so this rides on training losses rather than hormones. If volume climbs and you keep it daily, a retest turns the guess into an answer.`,
    };
  }
  // d3
  const dv = countDays(days, item.id, 28, today);
  return {
    itemId: item.id,
    title: 'Vitamin D',
    stage: 'retest due',
    pct: null,
    body: `${dv} of the last 28 days. Your last reading was already above range at 111 ng/mL, and this is fat-soluble so it accumulates instead of clearing. Every logged day is an argument for booking the retest rather than a milestone.`,
  };
}

/** generic adherence card for user-added items without a seeded kind */
export function genericCard(item: SupplementItem, days: SupplementDay[], today: ISODate): BodyCard {
  const n = countDays(days, item.id, 28, today);
  return {
    itemId: item.id,
    title: item.name,
    stage: n === 0 ? 'not started' : `${n} of 28 days`,
    pct: (n / 28) * 100,
    body:
      n === 0
        ? 'Nothing logged in the last four weeks. The card starts reading once the first doses land.'
        : `${n} of the last 28 days. Day count is the whole story here — consistency is what any supplement needs before it can be judged.`,
  };
}

export function bodyCards(
  items: SupplementItem[],
  days: SupplementDay[],
  today: ISODate
): BodyCard[] {
  return items
    .filter((it) => it.active || countDays(days, it.id, 28, today) > 0)
    .sort((a, b) => a.order - b.order)
    .map((it) => (it.kind ? kindCard(it.kind, it, days, today) : genericCard(it, days, today)));
}

// ---------- 14-day strip ----------

export interface StripDay {
  date: ISODate;
  taken: number;
  pct: number; // 0–100 of the active item count
  isToday: boolean;
  /** day-of-month label, shown every other day */
  label: string;
}

export function stripData(
  days: SupplementDay[],
  itemCount: number,
  today: ISODate
): { bars: StripDay[]; legend: string } {
  const bars: StripDay[] = [];
  let total = 0;
  let activeDays = 0;
  for (let i = 13; i >= 0; i--) {
    const date = addDays(today, -i);
    const taken = Object.keys(days.find((d) => d.date === date)?.taken ?? {}).length;
    total += taken;
    if (taken > 0) activeDays++;
    bars.push({
      date,
      taken,
      pct: itemCount > 0 ? Math.round((taken / itemCount) * 100) : 0,
      isToday: i === 0,
      label: i % 2 === 0 ? String(parseInt(date.slice(8), 10)) : '',
    });
  }
  const legend = activeDays
    ? `${total} doses across ${activeDays} day${activeDays === 1 ? '' : 's'}`
    : 'Nothing logged in this window yet.';
  return { bars, legend };
}

// ---------- the "Right now" banner ----------

export interface NowWindow {
  state: string;
  why: string;
}

/** Umut's day rhythm — the ambient banner, not a schedule enforcement */
const WINDOWS: Array<{ s: number; e: number } & NowWindow> = [
  { s: 0, e: 6, state: 'Asleep, ideally.', why: "Nothing scheduled. Last night's magnesium is still working through." },
  { s: 6, e: 6.42, state: 'Clear window — magnesium absorbing', why: 'Fastest belt of the day. Keep fat out of it for another twenty minutes.' },
  { s: 6.42, e: 7, state: 'Fat entering — coconut oil', why: 'Gastric emptying is slowing now, which is fine; the capsule has moved on.' },
  { s: 7, e: 8, state: 'Walking. Nothing taken.', why: 'This 45-minute gap is what makes the morning sequence hold together.' },
  { s: 8, e: 12, state: 'Fasted through to the first meal', why: "Espresso only. Nothing fat-soluble can absorb until there's fat." },
  { s: 12, e: 14, state: 'First meal — fat-soluble window open', why: 'Omega-3, D3K2 and zinc all belong to this one meal.' },
  { s: 14, e: 18, state: 'Nothing scheduled.', why: 'Gap between your two anchor meals.' },
  { s: 18, e: 21, state: 'Dinner — creatine and the second fat', why: "The meal's insulin response carries creatine from blood into muscle." },
  { s: 21, e: 24, state: 'Wind-down — magnesium before bed', why: 'Bisglycinate and taurate, ten hours clear of the zinc.' },
];

export function nowWindow(hourFloat: number): NowWindow {
  const h = Math.max(0, Math.min(23.999, hourFloat));
  const w = WINDOWS.find((x) => h >= x.s && h < x.e) ?? WINDOWS[0];
  return { state: w.state, why: w.why };
}

// ---------- reminders ----------

export interface ReminderGroup {
  /** "HH:MM" local */
  at: string;
  items: SupplementItem[];
}

/**
 * Active items that want a reminder, bundled by the minute they share.
 *
 * Grouping is the whole point: three things belong to the first meal, and
 * three separate pings for one glass of water is the kind of nagging that
 * gets notifications turned off entirely.
 */
export function reminderGroups(items: SupplementItem[]): ReminderGroup[] {
  const byTime = new Map<string, SupplementItem[]>();
  for (const it of items) {
    if (!it.active || !it.remindAt || !/^\d{2}:\d{2}$/.test(it.remindAt)) continue;
    const list = byTime.get(it.remindAt) ?? [];
    list.push(it);
    byTime.set(it.remindAt, list);
  }
  return [...byTime.entries()]
    .map(([at, list]) => ({ at, items: [...list].sort((a, b) => a.order - b.order) }))
    .sort((a, b) => a.at.localeCompare(b.at));
}

/** what a grouped reminder should say — names, not mechanisms */
export function reminderBody(group: ReminderGroup): string {
  const names = group.items.map((i) => i.name);
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** stable id for user-added items */
export function newSupplementId(existing: SupplementItem[]): string {
  let n = existing.length + 1;
  let id = `custom_${n}`;
  const ids = new Set(existing.map((i) => i.id));
  while (ids.has(id)) id = `custom_${++n}`;
  return id;
}
