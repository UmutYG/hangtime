// Small, non-nagging form notes — one per session, not a checklist to obey.
// Drawn from established strict-form conventions, not invented: dead-hang /
// full-range pull-up standards (no kipping, full lockout top and bottom),
// rigid-plank push-up form (straight body line, full elbow lockout, controlled
// tempo), and standard running-form cues (midfoot landing under the hip,
// relaxed upper body, quick cadence over overstriding).
//
// Philosophy: these are reminders, never instructions. One shows per session
// (or per run), reinforced by repetition rather than variety — that's what
// actually retrains a habit that's already mostly there.

import { Modality } from './load';

export const FORM_CUES: Record<Modality, string[]> = {
  pull: [
    'Full hang at the bottom, arms straight, before the next pull starts.',
    'Chin clears the bar — not just your eyes.',
    'Set your shoulders down before you pull. The movement starts there, not at the elbows.',
    'Down counts as much as up — control the last few inches instead of dropping into them.',
    "If the legs start swinging to help, that rep's borrowed, not earned.",
    "Ribs down — a slight hollow body keeps the pull honest, no arching to reach.",
    'Neck long, eyes forward. Craning up doesn’t get you there any faster.',
    'Same tempo on the first rep and the last — fatigue is when form is actually tested.',
  ],
  push: [
    'One straight line, ankles to shoulders — no sagging hips, no piking up.',
    'Chest brushes the floor, not just close. That’s the rep that counts.',
    'Elbows trace back at roughly 45°, not flared straight out to the sides.',
    'Lock out fully at the top — that’s where the rep actually ends.',
    'Brace the core like someone’s about to prod your stomach.',
    'Down under control, not a bounce off the chest.',
    'Hands roughly under the shoulders, fingers spread for a stable base.',
    'Head follows the spine — no craning forward to watch the floor.',
  ],
  run: [
    'Feet land under the hips, not out in front — overstriding brakes every step.',
    'Shoulders down and loose. Tension up top burns energy the legs need.',
    'Quick, light steps beat long, hard ones — a cadence that feels almost hurried.',
    'A slight forward lean from the ankles, not a bend at the waist.',
    'Relaxed hands, like holding something you don’t want to crush.',
    'Breathe as deep as the pace allows — shallow chest breathing runs out fast.',
  ],
};

export function formCueFor(modality: Modality, seed: number): string {
  const list = FORM_CUES[modality];
  const idx = ((seed % list.length) + list.length) % list.length;
  return list[idx];
}
