// e1RM math on SYSTEM weight (bodyweight + added load) — Epley formula.

export function e1rmSystem(bodyweightKg: number, addedKg: number, reps: number): number {
  const system = bodyweightKg + addedKg;
  return system * (1 + reps / 30);
}

/** Added load that should allow ~`reps` reps, derived from a system-weight e1RM. */
export function addedLoadForReps(e1rmKg: number, bodyweightKg: number, reps: number): number {
  const system = e1rmKg / (1 + reps / 30);
  return Math.max(0, system - bodyweightKg);
}

export function roundToIncrement(kg: number, incrementKg: number): number {
  return Math.round(kg / incrementKg) * incrementKg;
}

export function floorToIncrement(kg: number, incrementKg: number): number {
  return Math.floor(kg / incrementKg) * incrementKg;
}
