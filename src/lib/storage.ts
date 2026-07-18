import AsyncStorage from '@react-native-async-storage/async-storage';
import { Store } from '../engine/types';

const KEY = 'hangtime.store.v1';

export function emptyStore(): Store {
  return {
    version: 1,
    profile: null,
    state: {
      calibrated: false,
      cycle: 1,
      week: 1,
      sessionInWeek: 1,
      weighted: {
        loadKg: 0,
        lastReps: [4, 4, 4, 4],
        failStreak: 0,
        grindStreak: 0,
        stallCount: 0,
        sessionsAtLoad: 0,
        microload: false,
        backoffNext: false,
      },
      bwBestMaxSet: 0,
      bwLastTestReps: 0,
      e1rmKg: null,
      pendingDeload: false,
      lastSessionDate: null,
    },
    sessions: [],
    prs: [],
    tests: [],
    lifetimeReps: 0,
  };
}

export function migrate(raw: unknown): Store {
  const s = raw as Partial<Store> | null;
  if (!s || typeof s !== 'object' || s.version !== 1) return emptyStore();
  // future migrations step version by version here
  return { ...emptyStore(), ...s } as Store;
}

export async function loadStore(): Promise<Store> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return emptyStore();
    return migrate(JSON.parse(raw));
  } catch {
    return emptyStore();
  }
}

export async function saveStore(store: Store): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(store));
}

export function exportJson(store: Store): string {
  return JSON.stringify(store, null, 2);
}

export function importJson(json: string): Store {
  return migrate(JSON.parse(json));
}
