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

const FILE = '/hangtime-store.json';

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
 * Last-write-wins by updatedAt, with one guard: a cloud store that has real
 * training data always beats an empty local store (fresh install restore).
 */
export function pickNewer(local: Store, cloud: Store | null): { winner: Store; from: 'local' | 'cloud' } {
  if (!cloud) return { winner: local, from: 'local' };
  const localEmpty = local.profile === null && local.sessions.length === 0;
  const cloudHasData = cloud.profile !== null || cloud.sessions.length > 0;
  if (localEmpty && cloudHasData) return { winner: cloud, from: 'cloud' };
  if ((cloud.updatedAt ?? '') > (local.updatedAt ?? '')) return { winner: cloud, from: 'cloud' };
  return { winner: local, from: 'local' };
}
