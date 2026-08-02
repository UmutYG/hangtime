# Roof — the lines that don't move

Constraints, not a manifesto. If a change breaks one of these, it's the wrong change.

## What Roof is

A container for a life, not an app about a hobby. Home is a map of **life areas** — Body, Mind, Supplements today; whatever its owner actually lives tomorrow. Each area opens into a self-contained module with its own inner navigation, its own vocabulary, its own rules. A new need becomes a new room; it never becomes a feature bolted onto an existing one.

The phone is a tool, not the point. Every room has to earn its place by mapping to something real outside the screen — and nothing else gets in.

## Hard constraints

**One backup, covering everything.**
Rooms own their storage, but they do not own their own cloud. There is exactly one snapshot — training, supplements, mind — pushed to one account (`src/lib/roofBackup.ts`). A room that invents its own sync is how data ends up stranded in a system nothing else can read. Sign-in is optional and asked for once; the app is fully usable without it.

**A restore may never destroy.**
Restoring merges — the store through the same union-merge that guards device-to-device sync, mind keys by key. A backup file can only ever write keys the app already knows. Nothing pushes to an account before it has read what is already there.

**Modules are sovereign.**
A room owns its data, its storage keys, its screens, and its language. Body's readiness engine and Mind's mirror share nothing but the roof over them. Cross-module dashboards, unified scores, and "insights" blending unrelated areas are refused — a real life doesn't average.

**Adding a room must not disturb the others.**
Home stays one calm card per area. If a fifth room makes the map busier rather than fuller, the map is wrong, not the room.

**The training engine is deterministic. No LLM in the programming loop.**
Every prescription comes from published, outcome-proven methods (K Boges sub-max volume, One Hundred Push-ups, Pavel ladders, double progression, velocity-loss-derived fade thresholds, Foster session-RPE). Same inputs always produce the same session. `src/engine/` stays pure — no React Native imports, no `Date.now()` inside decisions, unit-tested.

**Advise, never command.**
Form cues are observations ("chin clears the bar"), never orders — enforced by a test that rejects "must", "should", and "!". Interrupted sessions are offered, not resumed. Readiness informs; it never blocks. Supplements are placed, never demanded — and skipping one is a first-class answer the app records without comment, not a gap it nags about. Mind mirrors; it never instructs.

**Describe the day that happened, not the one that was planned.**
A protocol written for a Tuesday is a lie on a Saturday. Nothing may assert a routine from the clock alone: what the app says about a dose comes from how it was actually taken, when, and what it landed near — and a dose that absorbs less is information, never a failure. There is always a version of the day that still works, and the copy has to say so. Enforced by a test that rejects "should", "must", "wrong", and "too late" in every generated line.

**Measurement days stay honest.**
Variations, autoregulation, and trims apply to volume and ladder days only. Max days and tests are always the standard movement at full prescription — otherwise the numbers driving the program start lying. `progressionExempt` means *not judged*.

**Explain every decision.**
Anything a module changes, it says why, in plain language, with the actual numbers. Trust is earned by being inspectable.

**One body under one roof.**
Pull-ups, push-ups, and running share a single load and readiness model (`src/engine/load.ts`). A hard pull day is not free when push day arrives.

**Sessions are the source of truth.**
All derived state (PRs, cycle position, tunes, lifetime counts) is rebuilt by replaying the log. Never store a computed value replay can't reproduce.

## Refuse-list

Do not add, however well-intentioned:

- Daily streaks — consistency is sessions per week, and a missed day must never feel like failure
- Badges, XP, points, achievement toasts
- Social features, feeds, leaderboards, sharing
- An LLM anywhere in prescription
- Permissions for data the app doesn't actually display
- A room for something its owner doesn't already do in real life

## On notifications

Roof is silent unless a room's purpose genuinely requires interrupting. Two do. **Mind** exists to break the habit of forgetting a good moment the second it happens — a mirror nobody looks into isn't a mirror. **Supplements** are taken at times, and a protocol you remember at midnight is a protocol you didn't follow.

Nothing else may schedule anything, and the two that do obey the same rules: every notification is tagged with its room and a room may only ever cancel its own; reminders group by moment rather than firing per item; anything already answered — taken, skipped, logged — drops out of the rest of the day. They never count, score, or scold.

## The point

Rep counts, doses, and logged signs are scaffolding. Roof exists so its owner can tend the areas of a life he is actually living — reflect, and evolve. Not to supervise him, and not to become somewhere he spends time.
