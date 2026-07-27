# Hangtime — the lines that don't move

Constraints, not a manifesto. If a change breaks one of these, it's the wrong change.

## Hard constraints

**The engine is deterministic. No LLM in the programming loop.**
Every prescription comes from published, outcome-proven methods (K Boges sub-max volume, One Hundred Push-ups, Pavel ladders, double progression, velocity-loss-derived fade thresholds, Foster session-RPE). Same inputs always produce the same session. An AI guessing at sets and reps is the thing this app was built to avoid. `src/engine/` stays pure — no React Native imports, no `Date.now()` inside decisions, unit-tested.

**Advise, never command.**
Readiness pre-selects a chip; one tap overrides it. Form cues are observations ("chin clears the bar"), never orders — enforced by a test that rejects "must", "should", and "!". Interrupted sessions are offered, not resumed automatically. Rest-day awareness informs; it never blocks a workout.

**Measurement days stay honest.**
Variations, autoregulation, and trims apply to volume and ladder days only. Pyramid finishers, max days, and tests are always the standard movement at full prescription — otherwise the numbers that drive the whole program start lying. Sessions marked `progressionExempt` (rough days, layoff ramps) can never lower a max or tighten a tune: exempt means *not judged*.

**Explain every decision.**
Anything the engine changes, it says why, in plain language, with the actual numbers. Trust is earned by being inspectable — that's why the "why" layer exists and why adaptations report the metrics they acted on.

**One body, three spaces.**
Pull-ups, push-ups, and running share a single load and readiness model (`src/engine/load.ts`). A hard pull day is not free when push day arrives.

**Sessions are the source of truth.**
All derived state (PRs, cycle position, tunes, lifetime counts) is rebuilt by replaying the log. Never store a computed value that replay can't reproduce.

## Refuse-list

Do not add, however well-intentioned:

- Daily streaks — consistency is sessions per week, and a missed day must never feel like failure
- Badges, XP, points, achievement toasts
- Social features, feeds, leaderboards, sharing
- An LLM chat coach, or an LLM anywhere in prescription
- Health permissions the app doesn't actually display
- Push notifications that nag

## The point

Rep counts are scaffolding. The app exists to celebrate what the body can do and to help its owner reflect and evolve — not to supervise him.
