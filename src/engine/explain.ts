import { Decision } from './types';

// The "why" layer — every algorithmic decision maps to plain English.
// `short` renders under the session title; `detail` expands on tap.

function fmt(kg: number): string {
  return `${kg % 1 === 0 ? kg : kg.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')} kg`;
}

export function explainShort(d: Decision): string {
  const p = d.params;
  switch (d.code) {
    case 'CALIBRATION':
      return `First weighted session: we find your working load today. Work up in sets of 3 until it feels like an 8/10 effort, then one all-out set.`;
    case 'FIRST_VEST_SESSION':
      return `First vest session. Targets are estimated from your bodyweight max — the all-out last set tells the program what the vest is really worth, and every number recalibrates from there.`;
    case 'VEST_FILL_REPS':
      return `Same vest (+${fmt(Number(p.load))}), sets of ${p.bottom}–${p.top}. Add a rep anywhere. When every set tops out, the program makes the day harder — more sets, then shorter rests.`;
    case 'ADD_SET':
      return `You topped every set, and the vest can't get heavier — so today has ${p.sets} sets instead of 4. Volume is the lever when load is fixed.`;
    case 'DENSITY_UP':
      return `All 5 sets topped out — next lever: rests drop to ${Math.round(Number(p.rest) / 60)} min. Same work, less time. Density is how you progress a fixed load.`;
    case 'SUGGEST_MORE_LOAD':
      return `You've outgrown this vest: 5 dense sets, all topped. The honest next step is more weight — until then, targets keep rising with your strength estimate.`;
    case 'LOAD_UP':
      return `You hit ${p.reps} @ +${fmt(Number(p.prevLoad))} — top of the range with reps to spare. The belt gets +${fmt(Number(p.increment))} and we rebuild from 4s.`;
    case 'LOAD_UP_MICRO':
      return `Range topped at +${fmt(Number(p.prevLoad))}, but progress has been hard-won — so a smaller +${fmt(Number(p.increment))} jump keeps it moving.`;
    case 'HOLD_FILL_REPS':
      return `Same load (+${fmt(Number(p.load))}) as last time. Goal: add a rep somewhere. When all sets reach 6, the load goes up.`;
    case 'REPEAT_AFTER_FAIL':
      return `Last session came up short, so today repeats the exact prescription. One off day means nothing — beat it today.`;
    case 'BACKOFF_SET':
      return `Your first sets are strong but the last one died — so the final set drops ~10 % for max reps instead. Volume without the grind.`;
    case 'DELOAD_SCHEDULED':
      return `Week 4: planned deload. Strength is built in recovery — this week locks in the last 3 weeks of work.`;
    case 'DELOAD_TRIGGERED':
      return `Two hard misses in a row — that's fatigue, not weakness. Early deload now, then we resume slightly lighter and rebuild fast.`;
    case 'SUBMAX_DERIVED':
      return `${p.sets}×${p.reps}: that's 50 % of your best max set (${p.bestMax}), short rests. Easy sets, big total — this is what builds rep capacity.`;
    case 'MAX_DAY':
      return `3 all-out sets, full 5-minute rests. This is where your nervous system learns to empty the tank — and where new rep PRs happen.`;
    case 'LADDER_DAY':
      return `Ladders: 1, 2, 3… up to ${p.topRung}, rest 30 s between rungs. Stop a ladder early if the next rung is in doubt — every rep stays crisp.`;
    case 'TEST_BW':
      return `Test day: one all-out max set, fresh. Take it only if you've had 2+ easy days. This number recalibrates your whole program.`;
    case 'TEST_WEIGHTED':
      return `Weighted 5RM test: work up to one heavy set of 5. This resets your training load and your strength estimate.`;
    case 'READINESS_TRIM':
      return `Rough day → one set removed. A trimmed session you finish beats a full one you skip.`;
    case 'LAYOFF_RAMP':
      return `${p.days} days off → today is slightly reduced to ramp back in. It won't count against your progression.`;
    case 'POST_DELOAD_RESUME':
      return `Back from deload at −5 % load — a running start. You'll be past your old numbers within two weeks.`;
    default:
      return '';
  }
}

export function explainDetail(d: Decision): string {
  switch (d.code) {
    case 'CALIBRATION':
      return `The load you find today seeds "double progression": we keep the load fixed and grow your reps from 4s to 6s across 4 sets. When every set hits 6 with a rep in reserve, the load goes up and reps reset to 4. Load follows reps — that's the engine.`;
    case 'FIRST_VEST_SESSION':
    case 'VEST_FILL_REPS':
    case 'ADD_SET':
    case 'DENSITY_UP':
      return `With a fixed load, real programs progress along three levers in order: reps per set, then total sets, then rest density. Your rep targets are re-derived from your strength estimate after every all-out set, so the day always sits ~2 reps shy of your max — hard enough to grow, never a grind.`;
    case 'SUGGEST_MORE_LOAD':
      return `Research consensus: once a load allows 10–12+ crisp reps per set across 5 dense sets, adding weight beats adding more volume. A heavier vest or a dip belt with plates re-opens the strength lever; the program adapts to whatever load you tell it in Settings.`;
    case 'LOAD_UP':
    case 'LOAD_UP_MICRO':
      return `Double progression: reps grow first, then load. Resetting to 4s after a load increase keeps every rep clean and keeps you 1–2 reps shy of failure, which research on strength training shows drives progress with far less fatigue than grinding.`;
    case 'HOLD_FILL_REPS':
      return `Adding one rep to one set is a real gain — at fixed load, total reps is the progress metric. Never grind the last rep; stopping 1–2 short of failure recovers faster and progresses just as fast.`;
    case 'REPEAT_AFTER_FAIL':
      return `Single-session dips are usually sleep, stress or fuel — not lost strength. The program only reacts to a pattern: two misses in a row triggers a deload.`;
    case 'DELOAD_SCHEDULED':
    case 'DELOAD_TRIGGERED':
      return `Fatigue masks fitness. Cutting volume ~50 % for a week lets accumulated fatigue drain while your adaptations stay — which is why testing right after a deload usually produces PRs.`;
    case 'SUBMAX_DERIVED':
      return `This is the K Boges sub-max volume method: many easy sets at 50 % of your max, 60 s rests. High frequency + zero failure = rep capacity grows while you stay fresh for the heavy day.`;
    case 'MAX_DAY':
      return `From K Boges' Pull Up Mastery: max-effort sets with full rest train motor-unit recruitment — strength as a skill. Your best set today also recalibrates the volume-day targets.`;
    case 'LADDER_DAY':
      return `Ladders (a Pavel Tsatsouline staple): each ladder starts easy, so you accumulate lots of quality reps with minimal fatigue. Stopping "when the next rung is in doubt" is the rule — no failure, ever.`;
    case 'TEST_BW':
    case 'TEST_WEIGHTED':
      return `Tests happen only after easy days because fatigue hides fitness. The result updates your goal ETA and re-derives every target in the program — this is how the plan stays honest.`;
    default:
      return '';
  }
}

export function buildWhy(decisions: Decision[]): { why: string; whyDetail: string } {
  const primary = decisions[0];
  if (!primary) return { why: '', whyDetail: '' };
  const extras = decisions.slice(1).map(explainShort).filter(Boolean);
  const detail = [explainDetail(primary), ...extras].filter(Boolean).join('\n\n');
  return { why: explainShort(primary), whyDetail: detail };
}
