import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { applyResult, replayAll } from '../engine/stateMachine';
import { LoggedSession, Profile, Store } from '../engine/types';
import { mergeRuns, Run } from '../engine/runs';
import { initialState } from '../engine/generator';
import { emptyStore, importJson, loadStore, saveStore, stamp } from '../lib/storage';
import { isCloudAvailable, pickNewer, pullFromCloud, pushToCloud, SyncState } from '../lib/cloudSync';
import { fetchRunsFromHealth, isHealthModuleAvailable, requestHealthAuth } from '../lib/health';

interface StoreApi {
  store: Store;
  ready: boolean;
  syncState: SyncState;
  lastSyncedAt: string | null;
  createProfile: (p: Profile) => void;
  updateProfile: (patch: Partial<Profile>) => void;
  completeSession: (session: LoggedSession) => { prCount: number };
  editSession: (session: LoggedSession) => void;
  deleteSession: (id: string) => void;
  restoreSession: (id: string) => void;
  emptyTrash: () => void;
  addRun: (run: Run) => void;
  editRun: (run: Run) => void;
  deleteRun: (id: string) => void;
  /** connect + pull runs from Apple Health; 'unavailable' in Expo Go / web */
  syncHealth: () => Promise<{ added: number } | 'unavailable' | 'denied'>;
  importStore: (json: string) => boolean;
  resetAll: () => void;
  syncNow: () => Promise<void>;
}

const Ctx = createContext<StoreApi | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [store, setStore] = useState<Store>(emptyStore());
  const [ready, setReady] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cloudTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // boot: local first (instant UI), then reconcile with iCloud
  useEffect(() => {
    (async () => {
      const local = await loadStore();
      setStore(local);
      setReady(true);
      if (!(await isCloudAvailable())) {
        setSyncState('unavailable');
        return;
      }
      setSyncState('syncing');
      const cloud = await pullFromCloud();
      const { winner, from } = pickNewer(local, cloud);
      if (from === 'cloud') {
        setStore(winner);
        void saveStore(winner);
      } else if (winner.profile !== null) {
        void pushToCloud(winner);
      }
      setSyncState('synced');
      setLastSyncedAt(new Date().toISOString());
    })();
  }, []);

  const persist = useCallback((s: Store) => {
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => void saveStore(s), 150);
    if (cloudTimer.current) clearTimeout(cloudTimer.current);
    cloudTimer.current = setTimeout(async () => {
      if (!(await isCloudAvailable())) return;
      setSyncState('syncing');
      const ok = await pushToCloud(s);
      setSyncState(ok ? 'synced' : 'error');
      if (ok) setLastSyncedAt(new Date().toISOString());
    }, 1200);
  }, []);

  const update = useCallback(
    (fn: (s: Store) => Store) => {
      setStore((prev) => {
        const next = stamp(fn(prev));
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const createProfile = useCallback(
    (p: Profile) => {
      update((s) => ({ ...s, profile: p, state: initialState(p) }));
    },
    [update]
  );

  const updateProfile = useCallback(
    (patch: Partial<Profile>) => {
      update((s) => (s.profile ? { ...s, profile: { ...s.profile, ...patch } } : s));
    },
    [update]
  );

  const completeSession = useCallback(
    (session: LoggedSession): { prCount: number } => {
      let prCount = 0;
      update((s) => {
        if (!s.profile) return s;
        const out = applyResult(s.profile, s.state, session, s.prs);
        prCount = out.newPrs.length;
        return {
          ...s,
          state: out.state,
          sessions: [...s.sessions, session],
          prs: [...s.prs, ...out.newPrs],
          tests: [...s.tests, ...out.newTests],
          lifetimeReps: s.lifetimeReps + out.repsDone,
        };
      });
      return { prCount };
    },
    [update]
  );

  // history edits treat sessions as the source of truth and replay everything
  const rebuilt = (s: Store, sessions: LoggedSession[], trash: LoggedSession[]): Store => {
    if (!s.profile) return { ...s, sessions, trash };
    const r = replayAll(s.profile, sessions);
    return { ...s, sessions, trash, ...r };
  };

  // Upsert: replaces an existing session by id, or appends a new one (manual
  // logs from History arrive with fresh ids). Sessions stay date-sorted so a
  // backdated log replays in the right order.
  const editSession = useCallback(
    (session: LoggedSession) => {
      update((s) => {
        const exists = s.sessions.some((x) => x.id === session.id);
        const sessions = exists
          ? s.sessions.map((x) => (x.id === session.id ? session : x))
          : [...s.sessions, session];
        sessions.sort((a, b) => a.date.localeCompare(b.date));
        return rebuilt(s, sessions, s.trash);
      });
    },
    [update]
  );

  const deleteSession = useCallback(
    (id: string) => {
      update((s) => {
        const target = s.sessions.find((x) => x.id === id);
        if (!target) return s;
        return rebuilt(
          s,
          s.sessions.filter((x) => x.id !== id),
          [target, ...s.trash].slice(0, 20)
        );
      });
    },
    [update]
  );

  const restoreSession = useCallback(
    (id: string) => {
      update((s) => {
        const target = s.trash.find((x) => x.id === id);
        if (!target) return s;
        const sessions = [...s.sessions, target].sort((a, b) => a.date.localeCompare(b.date));
        return rebuilt(s, sessions, s.trash.filter((x) => x.id !== id));
      });
    },
    [update]
  );

  const emptyTrash = useCallback(() => {
    update((s) => ({ ...s, trash: [] }));
  }, [update]);

  const addRun = useCallback(
    (run: Run) => {
      update((s) => ({ ...s, runs: mergeRuns(s.runs, [run], s.deletedRunIds) }));
    },
    [update]
  );

  const editRun = useCallback(
    (run: Run) => {
      update((s) => ({
        ...s,
        runs: s.runs
          .map((r) => (r.id === run.id ? run : r))
          .sort((a, b) => a.date.localeCompare(b.date)),
      }));
    },
    [update]
  );

  const deleteRun = useCallback(
    (id: string) => {
      update((s) => {
        const target = s.runs.find((r) => r.id === id);
        return {
          ...s,
          runs: s.runs.filter((r) => r.id !== id),
          // remember Health-imported ids so the next sync doesn't resurrect them
          deletedRunIds:
            target?.source === 'health' ? [...s.deletedRunIds, id] : s.deletedRunIds,
        };
      });
    },
    [update]
  );

  const syncHealth = useCallback(async (): Promise<
    { added: number } | 'unavailable' | 'denied'
  > => {
    if (!isHealthModuleAvailable()) return 'unavailable';
    const authorized = await requestHealthAuth();
    if (!authorized) return 'denied';
    const imported = await fetchRunsFromHealth();
    let added = 0;
    update((s) => {
      const merged = mergeRuns(s.runs, imported, s.deletedRunIds);
      added = merged.length - s.runs.length;
      return { ...s, runs: merged, healthEnabled: true };
    });
    return { added };
  }, [update]);

  // silent refresh on launch once the user has connected Health
  useEffect(() => {
    if (!ready || !store.healthEnabled) return;
    void syncHealth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, store.healthEnabled]);

  const importStore = useCallback(
    (json: string): boolean => {
      try {
        const imported = importJson(json);
        update(() => imported);
        return true;
      } catch {
        return false;
      }
    },
    [update]
  );

  const resetAll = useCallback(() => update(() => emptyStore()), [update]);

  const syncNow = useCallback(async () => {
    if (!(await isCloudAvailable())) {
      setSyncState('unavailable');
      return;
    }
    setSyncState('syncing');
    const cloud = await pullFromCloud();
    const { winner, from } = pickNewer(store, cloud);
    if (from === 'cloud') {
      setStore(winner);
      void saveStore(winner);
    } else {
      await pushToCloud(winner);
    }
    setSyncState('synced');
    setLastSyncedAt(new Date().toISOString());
  }, [store]);

  return (
    <Ctx.Provider
      value={{
        store,
        ready,
        syncState,
        lastSyncedAt,
        createProfile,
        updateProfile,
        completeSession,
        editSession,
        deleteSession,
        restoreSession,
        emptyTrash,
        addRun,
        editRun,
        deleteRun,
        syncHealth,
        importStore,
        resetAll,
        syncNow,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useStore(): StoreApi {
  const api = useContext(Ctx);
  if (!api) throw new Error('useStore outside StoreProvider');
  return api;
}
