import AsyncStorage from '@react-native-async-storage/async-storage';
import { Store } from '../engine/types';
import { mergeStores } from '../engine/merge';
import { migrate } from './storage';

// The central backup: ONE snapshot covering every room under the roof.
//
// Rooms own their storage independently — the training/supplement store is a
// single JSON blob under `hangtime.store.v1`, the mind module keeps a dozen
// small AsyncStorage keys. A backup that only understood one of them is what
// stranded the Slide data in the first place, so this format holds both and
// nothing else needs its own cloud path.

/** every AsyncStorage key the mind module owns (mirrors the standalone Slide app) */
export const MIND_KEYS = [
  'settings:v2',
  'settings:v1',
  'events:v1',
  'strengths:v1',
  'reframes:v1',
  'visionReflections:v1',
  'visionWhyLastAsked',
  'dailyRecap:v2',
  'weeklyRecap:v1',
  'recapDoneV2',
  'mirrorFeed:v1',
  'mirrorThanks:v1',
  'voicePack:v3',
  'whyQuestions:v1',
  'dissolveRatings:v1',
  'dissolveAskedWeek',
] as const;

const MIND_KEY_SET = new Set<string>(MIND_KEYS);

export interface RoofSnapshot {
  app: 'roof';
  v: 1;
  exportedAt: string;
  /** the training + supplements store, already migrated */
  store: Store | null;
  /** raw mind AsyncStorage values, key → serialized value */
  mind: Record<string, string>;
  /**
   * The same mind values under the key the standalone Slide app reads.
   *
   * Both apps share one account row, and Slide overwrites it whenever it goes
   * to the background. Mirroring the mind here means a Roof backup still
   * restores correctly if it's ever opened by Slide — the two can coexist
   * without either one silently emptying the other.
   */
  data: Record<string, string>;
}

/** What kind of backup is this JSON? Slide's own exports stay readable forever. */
export type SnapshotShape = 'roof' | 'slide-legacy' | 'unknown';

export function detectShape(parsed: unknown): SnapshotShape {
  const o = parsed as Record<string, unknown> | null;
  if (!o || typeof o !== 'object') return 'unknown';
  if (o.app === 'roof' && o.v === 1) return 'roof';
  // Slide's backup: { app: 'slide-tracker', exportedAt, data: {key: value} }
  if (o.data && typeof o.data === 'object') return 'slide-legacy';
  return 'unknown';
}

async function readMindKeys(): Promise<Record<string, string>> {
  const pairs = await AsyncStorage.multiGet([...MIND_KEYS]);
  const mind: Record<string, string> = {};
  for (const [k, v] of pairs) if (v != null) mind[k] = v;
  return mind;
}

/** Build the snapshot from whatever is on this device right now. */
export async function buildSnapshot(store: Store): Promise<RoofSnapshot> {
  const mind = await readMindKeys();
  return {
    app: 'roof',
    v: 1,
    exportedAt: new Date().toISOString(),
    store,
    mind,
    data: mind, // readable by the standalone Slide app — see RoofSnapshot.data
  };
}

export interface RestoreResult {
  shape: SnapshotShape;
  /** mind keys written */
  mindKeys: number;
  /** the store to adopt, or null when the snapshot carried none (legacy Slide) */
  store: Store | null;
}

/**
 * Apply a backup to this device.
 *
 * Mind keys are written straight through — they are the module's own format.
 * The store is *merged*, never replaced, so restoring on a device that has
 * trained since the backup can't erase those sessions (same union-merge that
 * protects iCloud sync). Anything that isn't a known mind key or the store is
 * ignored: a backup file can never write arbitrary keys into this app.
 */
export async function applySnapshot(json: string, localStore: Store): Promise<RestoreResult> {
  const parsed = JSON.parse(json) as unknown;
  const shape = detectShape(parsed);
  if (shape === 'unknown') throw new Error('not a Roof or Slide backup');

  let mind: Record<string, string> = {};
  let store: Store | null = null;

  if (shape === 'roof') {
    const snap = parsed as RoofSnapshot;
    mind = snap.mind ?? {};
    if (snap.store) store = mergeStores(localStore, migrate(snap.store));
  } else {
    // A Slide export — mind keys only, living under `data`.
    const legacy = parsed as { data?: Record<string, unknown> };
    for (const [k, v] of Object.entries(legacy.data ?? {})) {
      if (typeof v === 'string' && MIND_KEY_SET.has(k)) mind[k] = v;
    }
  }

  const entries = Object.entries(mind).filter(
    ([k, v]) => typeof v === 'string' && MIND_KEY_SET.has(k)
  ) as [string, string][];
  if (entries.length > 0) await AsyncStorage.multiSet(entries);

  return { shape, mindKeys: entries.length, store };
}

/** Does this device hold any mind data yet? Guards the "don't overwrite" checks. */
export async function mindLooksEmpty(): Promise<boolean> {
  const [events, settings] = await AsyncStorage.multiGet(['events:v1', 'settings:v2']);
  if (events[1] && events[1] !== '[]') return false;
  if (settings[1]) {
    try {
      const s = JSON.parse(settings[1]);
      if ((s.visionCards?.length ?? 0) > 0 || s.dreamPortrait) return false;
    } catch {
      /* unreadable — treat as empty */
    }
  }
  return true;
}
