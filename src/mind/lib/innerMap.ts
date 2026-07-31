import { getVisionReflections } from "./visionReflections";
import { getStrengthStore } from "./strengths";
import { getReframes } from "./reframes";
import { loadSettings } from "./settings";

// The person's quiet mental map, composed for prompt injection only — never
// surfaced. Every consumer already carries the "NEVER quote, reference or
// hint at these directly" discipline in its prompt; this just widens what
// the mirror knows beyond vision reflections: the strengths they've accepted
// in themselves, and what tends to weigh on them (from the reframe ritual).
// Hard-capped at ~12 short lines, each field trimmed, so the map costs a few
// hundred tokens at most no matter how much the person has written.
// English framing labels are fine — these lines are prompt-side only, and
// every existing consumer already mixes user-language content into English
// prompts.

function trim(s: string, max = 120): string {
  const t = s.trim();
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

export async function buildInnerNotes(): Promise<string[]> {
  const notes: string[] = [];
  const settings = await loadSettings().catch(() => null);

  // 0. The dream portrait — their own freeform picture of who they are
  //    becoming, embellished whenever they feel like it. First in the map:
  //    it's the clearest thing the mirror can hold, and the richer it gets
  //    the sharper everything generated around it becomes.
  const portrait = settings?.dreamPortrait?.trim();
  if (portrait) {
    notes.push(`Their own portrait of the person they are becoming: "${trim(portrait, 400)}"`);
  }

  // 1. Vision reflections — the original listening channel. Format kept
  //    identical to what every consumer used to build inline, so prompt
  //    behavior is unchanged for existing users.
  try {
    let reflections = await getVisionReflections();
    // Only reflections about slides still on the wall. An archived vision has
    // dissolved out of the picture; letting its old Q→A pairs keep shaping
    // generated copy made new "why" questions echo visions the person no
    // longer holds.
    if (settings) {
      const active = new Set(settings.visionCards.map((c) => c.id));
      reflections = reflections.filter((r) => active.has(r.cardId));
    }
    for (const r of reflections.slice(0, 6)) {
      notes.push(`${trim(r.question)} → ${trim(r.answer)}`);
    }
  } catch {}

  // 2. Strengths they already see in themselves — self-acceptance is half
  //    the mirror; until now the AI never knew about this side.
  try {
    const store = await getStrengthStore();
    if (store.strengths.length > 0) {
      const names = store.strengths.slice(0, 5).map((s) => trim(s.text, 60));
      notes.push(`They already see these strengths in themselves: ${names.join(", ")}`);
      for (const n of store.notes.slice(0, 2)) {
        const strength = store.strengths.find((s) => s.id === n.strengthId);
        if (strength) notes.push(`Saw "${trim(strength.text, 60)}" in: ${trim(n.text)}`);
      }
    }
  } catch {}

  // 3. Importance patterns from the reframe ritual — what tends to loom
  //    large for this person, in their own words.
  try {
    const reframes = await getReframes(3);
    for (const r of reframes) {
      if (r.importanceAnswer) {
        notes.push(
          `Has been weighing on them: "${trim(r.negative)}" — because: "${trim(r.importanceAnswer)}"`
        );
      } else if (r.takeaway) {
        notes.push(`Came to see: "${trim(r.takeaway)}"`);
      }
    }
  } catch {}

  return notes.slice(0, 12);
}
