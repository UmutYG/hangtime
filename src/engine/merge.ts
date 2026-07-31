// Merging two copies of the store — pure logic, no RN imports.
//
// Sync used to be last-write-wins on the whole file, which is fine with one
// device and destructive with two: whichever device wrote last erased the
// other's sessions. Training history is append-only, so it merges cleanly by
// id instead. Everything derived (state, PRs, tests, lifetime counters) is
// recomputed by replay afterwards rather than copied from either side.

import { JointReport, LoggedSession, Store, SupplementDay, SupplementItem } from './types';
import { replayAll } from './stateMachine';
import { replayPushAll } from './pushups';
import { mergeRuns } from './runs';

/** Union by id; entries from `primary` win when both sides have the same id. */
function unionById(primary: LoggedSession[], secondary: LoggedSession[]): LoggedSession[] {
  const byId = new Map<string, LoggedSession>();
  for (const s of secondary) byId.set(s.id, s);
  for (const s of primary) byId.set(s.id, s);
  return [...byId.values()].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

function mergeJointLogs(primary: JointReport[], secondary: JointReport[]): JointReport[] {
  const byDate = new Map<string, JointReport>();
  for (const j of secondary) byDate.set(j.date, j);
  for (const j of primary) byDate.set(j.date, j);
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-120);
}

/** Item edits win from the newer store; items only one side knows survive. */
function mergeSupItems(primary: SupplementItem[], secondary: SupplementItem[]): SupplementItem[] {
  const byId = new Map<string, SupplementItem>();
  for (const it of secondary) byId.set(it.id, it);
  for (const it of primary) byId.set(it.id, it);
  return [...byId.values()].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

/** Union by date; within a day, ticks from both devices combine. A same-day
 *  untoggle on one device can resurrect from the other — accepted for a
 *  single-user reality, and one extra tick beats a lost one. */
function mergeSupDays(primary: SupplementDay[], secondary: SupplementDay[]): SupplementDay[] {
  const byDate = new Map<string, SupplementDay>();
  for (const d of secondary) byDate.set(d.date, d);
  for (const d of primary) {
    const other = byDate.get(d.date);
    byDate.set(d.date, other ? { date: d.date, taken: { ...other.taken, ...d.taken } } : d);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Merge a local and a cloud copy into one store neither device would lose data from.
 * Deletions win over presence — a session deleted on one device lands in the merged
 * trash rather than being resurrected, and stays restorable there.
 */
export function mergeStores(local: Store, cloud: Store): Store {
  const cloudNewer = (cloud.updatedAt ?? '') > (local.updatedAt ?? '');
  const primary = cloudNewer ? cloud : local;
  const secondary = cloudNewer ? local : cloud;

  // trash first: anything either device deleted stays deleted
  const trash = unionById(primary.trash, secondary.trash);
  const trashIds = new Set(trash.map((s) => s.id));
  const sessions = unionById(primary.sessions, secondary.sessions).filter(
    (s) => !trashIds.has(s.id)
  );

  const pushTrash = unionById(primary.pushTrash, secondary.pushTrash);
  const pushTrashIds = new Set(pushTrash.map((s) => s.id));
  const pushSessions = unionById(primary.pushSessions, secondary.pushSessions).filter(
    (s) => !pushTrashIds.has(s.id)
  );

  const deletedRunIds = [...new Set([...primary.deletedRunIds, ...secondary.deletedRunIds])];
  const runs = mergeRuns(secondary.runs, primary.runs, deletedRunIds);

  const merged: Store = {
    ...primary,
    // preferences and scalars come from whichever device wrote most recently
    profile: primary.profile ?? secondary.profile,
    pushStartingMax: primary.pushState ? primary.pushStartingMax : secondary.pushStartingMax,
    healthEnabled: primary.healthEnabled || secondary.healthEnabled,
    jointLog: mergeJointLogs(primary.jointLog ?? [], secondary.jointLog ?? []),
    supItems: mergeSupItems(primary.supItems ?? [], secondary.supItems ?? []),
    supDays: mergeSupDays(primary.supDays ?? [], secondary.supDays ?? []),
    sessions,
    trash,
    pushSessions,
    pushTrash,
    runs,
    deletedRunIds,
    // never claim a write time newer than either device actually produced
    updatedAt:
      (primary.updatedAt ?? '') > (secondary.updatedAt ?? '')
        ? primary.updatedAt
        : secondary.updatedAt,
  };

  // Derived state is a projection of the log — rebuild it, don't inherit it.
  if (merged.profile) {
    const r = replayAll(merged.profile, sessions);
    merged.state = r.state;
    merged.prs = r.prs;
    merged.tests = r.tests;
    merged.lifetimeReps = r.lifetimeReps;
  }
  if (merged.pushState || pushSessions.length > 0) {
    const startingMax = merged.pushStartingMax || primary.pushStartingMax || secondary.pushStartingMax;
    if (startingMax > 0) {
      const p = replayPushAll(startingMax, pushSessions);
      merged.pushState = p.state;
      merged.pushLifetimeReps = p.lifetimeReps;
      // push PRs live in the same list as pull PRs, so re-add them after the pull replay
      merged.prs = [...merged.prs.filter((x) => x.kind !== 'pushMax'), ...p.prs];
    }
  }

  return merged;
}

/** Did merging actually change this side? Used to avoid pointless writes. */
export function storeDiffers(a: Store, b: Store): boolean {
  const key = (s: Store) =>
    JSON.stringify([
      s.sessions.map((x) => x.id),
      s.pushSessions.map((x) => x.id),
      s.runs.map((x) => x.id),
      s.trash.map((x) => x.id),
      s.pushTrash.map((x) => x.id),
      s.deletedRunIds,
      (s.jointLog ?? []).map((j) => `${j.date}:${j.feel}`),
      (s.supDays ?? []).map((d) => `${d.date}:${Object.keys(d.taken).sort().join(',')}`),
      (s.supItems ?? []).map((i) => `${i.id}:${i.active ? 1 : 0}:${i.name}`),
      s.profile !== null,
    ]);
  return key(a) !== key(b);
}
