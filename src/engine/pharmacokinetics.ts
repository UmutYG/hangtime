// Where a dose actually is, right now — pure functions, no RN imports.
//
// absorption.ts answers "how much of this landed, given how you took it".
// This answers the other half: "where is it at this minute". Together they
// drive the body figure: absorption picks how brightly a site glows, this
// picks which site.
//
// The timings below are ordinary human pharmacokinetics, not invented
// numbers — gastric emptying, micelle formation, lymphatic transport for
// fat-solubles, plasma peaks, tissue uptake. They are approximate on
// purpose: the honest claim is "around now it's reaching your blood", never
// a to-the-minute simulation. Same tone rule as absorption.ts, enforced by
// the same kind of test: describe, never scold.

import type { SupplementContext, SupplementItem, SupplementKind, SupplementMech } from './types';

/** Places a dose passes through or acts on. The figure draws one per site. */
export type BodySite =
  | 'stomach'
  | 'intestine'
  | 'lymph'
  | 'liver'
  | 'blood'
  | 'muscle'
  | 'brain'
  | 'bone'
  | 'joints'
  | 'immune';

export const SITE_LABEL: Record<BodySite, string> = {
  stomach: 'Stomach',
  intestine: 'Small intestine',
  lymph: 'Lymphatic system',
  liver: 'Liver',
  blood: 'Bloodstream',
  muscle: 'Muscle',
  brain: 'Brain & nerves',
  bone: 'Bones',
  joints: 'Joints',
  immune: 'Immune tissue',
};

export interface Phase {
  site: BodySite;
  /** minutes after swallowing that this phase starts */
  from: number;
  /** minutes after swallowing that it ends */
  to: number;
  /** two or three words for the figure's caption */
  label: string;
  /** one sentence of what is happening there */
  body: string;
  /**
   * The tail phase — the part measured in weeks, not hours. The figure stops
   * animating here and just marks the site as where this one lives.
   */
  longArc?: boolean;
}

/** How far along a journey a dose is at some moment. */
export interface Position {
  phase: Phase;
  /** 0–1 through the current phase; 1 while in the long arc */
  progress: number;
  /** minutes since the dose was swallowed */
  elapsed: number;
  index: number;
}

// ---------------------------------------------------------------------------
// Journeys
// ---------------------------------------------------------------------------

// Written per kind where the route genuinely differs. Everything else falls
// back to its mechanism, which is what user-added items get.
const BY_KIND: Record<SupplementKind, Phase[]> = {
  creatine: [
    { site: 'stomach', from: 0, to: 25, label: 'Dissolving', body: 'Going into solution in the stomach — creatine monohydrate needs water more than it needs food.' },
    { site: 'intestine', from: 25, to: 70, label: 'Crossing over', body: 'Crossing the intestinal wall. Absorption here is close to complete; almost nothing of a 5 g dose is wasted at this step.' },
    { site: 'blood', from: 70, to: 120, label: 'Peaking in blood', body: 'Plasma creatine is around its peak. This is the easy part — getting it into blood was never the bottleneck.' },
    { site: 'muscle', from: 120, to: 300, label: 'Entering muscle', body: 'The muscle transporter is pulling it out of the blood and into the cell. Insulin from the meal is what holds that door open.' },
    { site: 'muscle', from: 300, to: Infinity, label: 'Saturating', body: 'Stored as phosphocreatine. This is the one that builds: three to four weeks of daily doses to fill the tank, and it stays full while you keep going.', longArc: true },
  ],
  omega: [
    { site: 'stomach', from: 0, to: 45, label: 'Waiting on fat', body: 'Sitting with the meal. Fat-soluble oils go nowhere until the meal\'s own fat triggers bile — this is why the timing with food matters.' },
    { site: 'intestine', from: 45, to: 150, label: 'Into micelles', body: 'Bile salts are wrapping the oil into micelles, the only form the gut wall will accept.' },
    { site: 'lymph', from: 150, to: 300, label: 'Through the lymph', body: 'Packaged into chylomicrons and travelling the lymphatic system — fats skip the liver on the way in and enter the blood near the collarbone.' },
    { site: 'blood', from: 300, to: 420, label: 'Reaching blood', body: 'EPA and DHA are arriving in circulation, roughly five to six hours after the meal.' },
    { site: 'brain', from: 420, to: Infinity, label: 'Into membranes', body: 'Being built into cell membranes — brain, retina, heart, joint linings. Measured in months, not days; the blood level moves long before the membranes do.', longArc: true },
  ],
  d3: [
    { site: 'stomach', from: 0, to: 45, label: 'Waiting on fat', body: 'Held with the meal. D3 rides the same fat the omega-3 needs — one fat source doing both jobs.' },
    { site: 'intestine', from: 45, to: 180, label: 'Into micelles', body: 'Joining the same micelles. K2 comes along on the same route.' },
    { site: 'lymph', from: 180, to: 420, label: 'Through the lymph', body: 'Travelling the lymphatics with the meal\'s fats before reaching circulation.' },
    { site: 'liver', from: 420, to: 1440, label: 'Liver conversion', body: 'The liver is converting it to 25-hydroxy-D — the storage form, and the one a blood test actually measures.' },
    { site: 'bone', from: 1440, to: Infinity, label: 'Banked', body: 'Stored in fat and released slowly; K2 directs the calcium toward bone rather than arteries. This one accumulates for weeks, which is exactly why the dose is worth watching.', longArc: true },
  ],
  zinc: [
    { site: 'stomach', from: 0, to: 30, label: 'With the meal', body: 'Moving through with food. Food is what keeps picolinate from turning into nausea.' },
    { site: 'intestine', from: 30, to: 120, label: 'At the transporters', body: 'Crossing on dedicated zinc transporters. These are limited in number, which is why a mineral taken alongside would have to queue.' },
    { site: 'blood', from: 120, to: 240, label: 'Peaking in blood', body: 'Plasma zinc is near its peak, carried on albumin.' },
    { site: 'immune', from: 240, to: Infinity, label: 'Into turnover', body: 'Distributed to immune cells, skin and repair tissue. There is no real storage pool, so this is daily replacement rather than a reservoir being filled.', longArc: true },
  ],
  magPm: [
    { site: 'stomach', from: 0, to: 20, label: 'Going down', body: 'Passing through quickly — a chelated form doesn\'t need stomach acid to break it apart.' },
    { site: 'intestine', from: 20, to: 90, label: 'Crossing intact', body: 'Bisglycinate crosses largely intact on the peptide route, which is what makes it gentle on the gut.' },
    { site: 'blood', from: 90, to: 180, label: 'In circulation', body: 'In the blood and heading for nerve and muscle tissue.' },
    { site: 'brain', from: 180, to: Infinity, label: 'Settling the system', body: 'Glycine and taurine are the calming part — both are quieting compounds in their own right, independent of the magnesium riding with them.', longArc: true },
  ],
};

// Mechanism fallbacks. A user-added item never has a kind, so these carry it.
const BY_MECH: Record<SupplementMech, Phase[]> = {
  clear: [
    { site: 'stomach', from: 0, to: 20, label: 'Going down', body: 'Passing through an empty stomach — the fastest handoff of the day, with nothing in the way.' },
    { site: 'intestine', from: 20, to: 80, label: 'Crossing over', body: 'Being taken up by active transport across the gut wall.' },
    { site: 'blood', from: 80, to: 160, label: 'In circulation', body: 'In the bloodstream and distributing.' },
    { site: 'muscle', from: 160, to: Infinity, label: 'In the tissues', body: 'Reaching the tissues that use it. Minerals like this are about steady daily supply rather than a stored reserve.', longArc: true },
  ],
  fat: [
    { site: 'stomach', from: 0, to: 45, label: 'Waiting on fat', body: 'Held with the meal until its fat arrives — without that, most of this would simply pass through.' },
    { site: 'intestine', from: 45, to: 150, label: 'Into micelles', body: 'Being wrapped into micelles by bile salts, the form the gut wall accepts.' },
    { site: 'lymph', from: 150, to: 300, label: 'Through the lymph', body: 'Travelling the lymphatic system with the meal\'s fats, bypassing the liver on the way in.' },
    { site: 'blood', from: 300, to: Infinity, label: 'In circulation', body: 'Arriving in the blood, several hours behind the meal that carried it.', longArc: true },
  ],
  gate: [
    { site: 'stomach', from: 0, to: 30, label: 'With the meal', body: 'Moving through with food, which is what keeps this one comfortable on the stomach.' },
    { site: 'intestine', from: 30, to: 120, label: 'At the transporters', body: 'Crossing on shared mineral transporters — a limited number of doors, taken in turn.' },
    { site: 'blood', from: 120, to: 240, label: 'Peaking in blood', body: 'Around its peak in circulation.' },
    { site: 'immune', from: 240, to: Infinity, label: 'Into turnover', body: 'Distributed into daily turnover rather than banked.', longArc: true },
  ],
  door: [
    { site: 'stomach', from: 0, to: 25, label: 'Dissolving', body: 'Going into solution and moving on quickly.' },
    { site: 'intestine', from: 25, to: 70, label: 'Crossing over', body: 'Absorbed nearly completely across the gut wall.' },
    { site: 'blood', from: 70, to: 120, label: 'Peaking in blood', body: 'At its peak in the blood — the step before the one that matters.' },
    { site: 'muscle', from: 120, to: Infinity, label: 'Entering the cell', body: 'Insulin from the meal is opening the transporter that moves it from blood into muscle.', longArc: true },
  ],
  food: [
    { site: 'stomach', from: 0, to: 40, label: 'With the meal', body: 'Being digested along with everything else in the meal.' },
    { site: 'intestine', from: 40, to: 180, label: 'Broken down', body: 'Broken down and absorbed as ordinary food energy.' },
    { site: 'blood', from: 180, to: Infinity, label: 'Fuel', body: 'Counting as part of the day\'s fat and energy — nothing here has an absorption job to do.', longArc: true },
  ],
};

/**
 * How much the stomach slows things down. An empty gut hands a dose on in
 * twenty minutes; a fatty meal can hold it for two hours. Everything
 * downstream shifts by the same amount rather than being squashed — the
 * intestine doesn't work faster just because the dose arrived late.
 */
function gastricFactor(mech: SupplementMech, ctx: SupplementContext | null): number {
  if (ctx === null) return 1;
  if (ctx === 'empty') return 0.6;
  if (ctx === 'food') return 1.5;
  // 'fat' — the slowest handoff there is, and for a fat-soluble dose it is
  // also the thing that makes absorption possible at all.
  return mech === 'fat' ? 1.6 : 2;
}

/** The route a dose takes, with the clock adjusted for how it was taken. */
export function journeyFor(item: SupplementItem, ctx: SupplementContext | null): Phase[] {
  const base = (item.kind && BY_KIND[item.kind]) || BY_MECH[item.mech];
  const f = gastricFactor(item.mech, ctx);
  if (f === 1) return base;

  const stomach = base[0];
  const shift = Math.round(stomach.to * (f - 1));
  return base.map((p, i) =>
    i === 0
      ? { ...p, to: p.to + shift }
      : { ...p, from: p.from + shift, to: p.to === Infinity ? Infinity : p.to + shift }
  );
}

/** "HH:MM" → minutes since midnight, or null if unparseable. */
export function parseClock(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm ?? '');
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/**
 * Where a dose is at `nowMinutes` (minutes since midnight today).
 *
 * `dayOffset` is how many days ago it was taken — a dose from yesterday is
 * simply deep in its long arc, not rewound. Returns null when the time can't
 * be read, which is exactly what a back-filled "time unknown" dose gives us:
 * no timestamp, so no claim about where it is.
 */
export function positionAt(
  item: SupplementItem,
  ctx: SupplementContext | null,
  takenAt: string,
  nowMinutes: number,
  dayOffset = 0
): Position | null {
  const start = parseClock(takenAt);
  if (start === null) return null;

  const elapsed = nowMinutes - start + dayOffset * 1440;
  if (elapsed < 0) return null; // logged for later today; nothing to show yet

  const phases = journeyFor(item, ctx);
  const idx = phases.findIndex((p) => elapsed < p.to);
  const index = idx === -1 ? phases.length - 1 : idx;
  const phase = phases[index];

  const span = phase.to - phase.from;
  const progress =
    !Number.isFinite(span) || span <= 0
      ? 1
      : Math.min(1, Math.max(0, (elapsed - phase.from) / span));

  return { phase, progress, elapsed, index };
}

/** Every site a journey touches, in order, deduplicated. */
export function sitesFor(item: SupplementItem, ctx: SupplementContext | null): BodySite[] {
  const out: BodySite[] = [];
  for (const p of journeyFor(item, ctx)) if (!out.includes(p.site)) out.push(p.site);
  return out;
}

/** "2h 15m ago" / "just now" — for captioning a live position. */
export function elapsedLabel(min: number): string {
  if (min < 2) return 'just now';
  if (min < 60) return `${Math.round(min)} min ago`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h < 24) return m ? `${h}h ${m}m ago` : `${h}h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}
