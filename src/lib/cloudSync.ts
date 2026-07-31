import { Platform } from 'react-native';
import { Store } from '../engine/types';
import { migrate } from './storage';

// iCloud Documents sync via react-native-cloud-storage.
// Native module only exists in real builds (TestFlight / dev-client) — in Expo Go
// the require fails and sync degrades to "unavailable" without breaking anything.

let CloudStorage: any = null;
try {
  if (Platform.OS === 'ios') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('react-native-cloud-storage');
    CloudStorage = mod.CloudStorage ?? mod.default ?? null;
  }
} catch {
  CloudStorage = null;
}

/** live store sync — union-merged on every change, so two devices converge */
const FILE = '/hangtime-store.json';
/** the central backup — a full snapshot of every room, written on background */
const BACKUP_FILE = '/roof-backup.json';

export type SyncState = 'unavailable' | 'idle' | 'syncing' | 'synced' | 'error';

export async function isCloudAvailable(): Promise<boolean> {
  if (!CloudStorage) return false;
  try {
    return (await CloudStorage.isCloudAvailable()) === true;
  } catch {
    return false;
  }
}

export async function pushToCloud(store: Store): Promise<boolean> {
  if (!CloudStorage) return false;
  try {
    await CloudStorage.writeFile(FILE, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}

export async function pullFromCloud(): Promise<Store | null> {
  if (!CloudStorage) return null;
  try {
    if (!(await CloudStorage.exists(FILE))) return null;
    const raw = await CloudStorage.readFile(FILE);
    return migrate(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * The central backup, in iCloud: one snapshot of the whole roof.
 *
 * Separate from the store sync above, and deliberately so — that one keeps two
 * devices converged minute to minute, this one is what a fresh install reads to
 * get everything back, mind included. Skips the write when nothing changed.
 */
let lastSnapshot: string | null = null;

export async function pushSnapshotToICloud(snapshotJson: string): Promise<boolean> {
  if (!CloudStorage) return false;
  try {
    if (!(await CloudStorage.isCloudAvailable())) return false;
    if (snapshotJson === lastSnapshot) return true;
    await CloudStorage.writeFile(BACKUP_FILE, snapshotJson);
    lastSnapshot = snapshotJson;
    return true;
  } catch {
    return false;
  }
}

export async function pullSnapshotFromICloud(): Promise<string | null> {
  if (!CloudStorage) return null;
  try {
    if (!(await CloudStorage.isCloudAvailable())) return null;
    if (!(await CloudStorage.exists(BACKUP_FILE))) return null;
    return (await CloudStorage.readFile(BACKUP_FILE)) as string;
  } catch {
    return null;
  }
}

/**
 * Last-write-wins by updatedAt. Superseded by `mergeStores` in src/engine/merge.ts,
 * which unions histories instead of replacing them — this destroys the other
 * device's sessions and is kept only as a reference for the old behaviour.
 *
 * @deprecated use mergeStores
 */
export function pickNewer(local: Store, cloud: Store | null): { winner: Store; from: 'local' | 'cloud' } {
  if (!cloud) return { winner: local, from: 'local' };
  const localEmpty = local.profile === null && local.sessions.length === 0;
  const cloudHasData = cloud.profile !== null || cloud.sessions.length > 0;
  if (localEmpty && cloudHasData) return { winner: cloud, from: 'cloud' };
  if ((cloud.updatedAt ?? '') > (local.updatedAt ?? '')) return { winner: cloud, from: 'cloud' };
  return { winner: local, from: 'local' };
}
