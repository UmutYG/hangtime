import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import { applyResult, replayAll } from '../engine/stateMachine';
import { applyPushResult, initialPushState, replayPushAll } from '../engine/pushups';
import {
  JointFeel,
  LoggedSession,
  Profile,
  Store,
  SupplementContext,
  SupplementItem,
  SupplementStatus,
} from '../engine/types';
import { setContext, setStatus } from '../engine/supplements';
import { mergeRuns, Run } from '../engine/runs';
import { initialState } from '../engine/generator';
import { emptyStore, importJson, loadStore, saveStore, stamp } from '../lib/storage';
import {
  isCloudAvailable,
  pullFromCloud,
  pullSnapshotFromICloud,
  pushSnapshotToICloud,
  pushToCloud,
  SyncState,
} from '../lib/cloudSync';
import { applySnapshot, buildSnapshot } from '../lib/roofBackup';
import { syncSupplementReminders } from '../lib/supplementNotifications';
import { mergeStores, storeDiffers } from '../engine/merge';
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
  setAppMode: (mode: Store['appMode']) => void;
  setJointFeel: (feel: JointFeel | null) => void;
  /** first entry into push-ups mode: seed the engine with the user's max */
  setPushMax: (max: number) => void;
  completePushSession: (session: LoggedSession) => { prCount: number };
  editPushSession: (session: LoggedSession) => void;
  deletePushSession: (id: string) => void;
  restorePushSession: (id: string) => void;
  emptyPushTrash: () => void;
  /** record a supplement as taken or skipped today, or clear it with null */
  setSupplementStatus: (itemId: string, status: SupplementStatus | null) => void;
  /** say how a dose went down — optional, and only for something already taken */
  setSupplementContext: (itemId: string, context: SupplementContext | null) => void;
  /** add a new item or save edits to an existing one (matched by id) */
  saveSupItem: (item: SupplementItem) => void;
  /** archive keeps history attached; restore brings it back to the daily list */
  setSupItemActive: (id: string, active: boolean) => void;
  importStore: (json: string) => boolean;
  resetAll: () => void;
  syncNow: () => Promise<void>;
  /** push the whole roof (store + every room's keys) to iCloud */
  cloudBackupNow: () => Promise<boolean>;
  /** pull the iCloud snapshot and merge it in */
  cloudRestore: () => Promise<{ mindKeys: number; shape: string } | null>;
  /** restore from a pasted Roof or Slide backup */
  restoreFromJson: (json: string) => Promise<{ mindKeys: number; shape: string }>;
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
      if (cloud) {
        // union-merge rather than last-write-wins: a second device must never
        // erase this one's history (or have its own erased)
        const merged = mergeStores(local, cloud);
        if (storeDiffers(merged, local)) {
          setStore(merged);
          void saveStore(merged);
        }
        // push whenever the cloud copy is missing anything we just merged in
        if (merged.profile !== null && storeDiffers(merged, cloud)) void pushToCloud(merged);
      } else if (local.profile !== null) {
        void pushToCloud(local);
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

  const setAppMode = useCallback(
    (mode: Store['appMode']) => {
      update((s) => ({ ...s, appMode: mode }));
    },
    [update]
  );

  const setPushMax = useCallback(
    (max: number) => {
      update((s) => ({ ...s, pushState: initialPushState(max), pushStartingMax: max }));
    },
    [update]
  );

  /** Optional joint check-in for today — one entry per day, latest answer wins.
   *  Tapping the current answer again clears it (the question stays optional). */
  const setJointFeel = useCallback(
    (feel: JointFeel | null) => {
      const today = new Date().toISOString().slice(0, 10);
      update((s) => {
        const rest = (s.jointLog ?? []).filter((j) => j.date !== today);
        const log = feel === null ? rest : [...rest, { date: today, feel }];
        log.sort((a, b) => a.date.localeCompare(b.date));
        return { ...s, jointLog: log.slice(-120) }; // ~4 months is plenty
      });
    },
    [update]
  );

  const completePushSession = useCallback(
    (session: LoggedSession): { prCount: number } => {
      let prCount = 0;
      update((s) => {
        if (!s.pushState) return s;
        const out = applyPushResult(s.pushState, session, s.prs);
        prCount = out.newPrs.length;
        return {
          ...s,
          pushState: out.state,
          pushSessions: [...s.pushSessions, session],
          prs: [...s.prs, ...out.newPrs],
          pushLifetimeReps: s.pushLifetimeReps + out.repsDone,
        };
      });
      return { prCount };
    },
    [update]
  );

  // push history edits: sessions are the source of truth, replay everything
  const pushRebuilt = (s: Store, sessions: LoggedSession[], trash: LoggedSession[]): Store => {
    if (!s.pushState) return { ...s, pushSessions: sessions, pushTrash: trash };
    const replayed = replayPushAll(s.pushStartingMax || s.pushState.bestMaxSet, sessions);
    return {
      ...s,
      pushSessions: sessions,
      pushTrash: trash,
      pushState: replayed.state,
      prs: [...s.prs.filter((p) => p.kind !== 'pushMax'), ...replayed.prs],
      pushLifetimeReps: replayed.lifetimeReps,
    };
  };

  const editPushSession = useCallback(
    (session: LoggedSession) => {
      update((s) => {
        const exists = s.pushSessions.some((x) => x.id === session.id);
        const sessions = exists
          ? s.pushSessions.map((x) => (x.id === session.id ? session : x))
          : [...s.pushSessions, session];
        sessions.sort((a, b) => a.date.localeCompare(b.date));
        return pushRebuilt(s, sessions, s.pushTrash);
      });
    },
    [update]
  );

  const deletePushSession = useCallback(
    (id: string) => {
      update((s) => {
        const target = s.pushSessions.find((x) => x.id === id);
        if (!target) return s;
        return pushRebuilt(
          s,
          s.pushSessions.filter((x) => x.id !== id),
          [target, ...s.pushTrash].slice(0, 20)
        );
      });
    },
    [update]
  );

  const restorePushSession = useCallback(
    (id: string) => {
      update((s) => {
        const target = s.pushTrash.find((x) => x.id === id);
        if (!target) return s;
        const sessions = [...s.pushSessions, target].sort((a, b) => a.date.localeCompare(b.date));
        return pushRebuilt(s, sessions, s.pushTrash.filter((x) => x.id !== id));
      });
    },
    [update]
  );

  const emptyPushTrash = useCallback(() => {
    update((s) => ({ ...s, pushTrash: [] }));
  }, [update]);

  // Keep supplement reminders in step with the stack and today's log: on
  // launch, and whenever either changes. Cheap — it cancels only its own and
  // re-derives the next few days.
  useEffect(() => {
    if (!ready) return;
    void syncSupplementReminders(store.supItems ?? [], store.supDays ?? []);
  }, [ready, store.supItems, store.supDays]);

  const setSupplementStatus = useCallback(
    (itemId: string, status: SupplementStatus | null) => {
      const today = new Date().toISOString().slice(0, 10);
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      update((s) => ({
        ...s,
        supDays: setStatus(s.supDays ?? [], today, itemId, status, time),
      }));
    },
    [update]
  );

  const setSupplementContext = useCallback(
    (itemId: string, context: SupplementContext | null) => {
      const today = new Date().toISOString().slice(0, 10);
      update((s) => ({ ...s, supDays: setContext(s.supDays ?? [], today, itemId, context) }));
    },
    [update]
  );

  const saveSupItem = useCallback(
    (item: SupplementItem) => {
      update((s) => {
        const items = s.supItems ?? [];
        const exists = items.some((i) => i.id === item.id);
        const next = exists ? items.map((i) => (i.id === item.id ? item : i)) : [...items, item];
        return { ...s, supItems: next.sort((a, b) => a.order - b.order) };
      });
    },
    [update]
  );

  const setSupItemActive = useCallback(
    (id: string, active: boolean) => {
      update((s) => ({
        ...s,
        supItems: (s.supItems ?? []).map((i) => (i.id === id ? { ...i, active } : i)),
      }));
    },
    [update]
  );

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

  // ——— central backup: one snapshot of the whole roof, kept in iCloud ———
  //
  // No account, nothing to sign into, and nothing that can be deleted out from
  // under it — the live store sync above keeps devices converged, this is the
  // full snapshot (mind included) a fresh install reads to get everything back.

  const storeRef = useRef(store);
  storeRef.current = store;

  // Every trip to the background quietly snapshots the roof.
  useEffect(() => {
    if (!ready) return;
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'background') return;
      void (async () => {
        const snap = await buildSnapshot(storeRef.current);
        await pushSnapshotToICloud(JSON.stringify(snap));
      })();
    });
    return () => sub.remove();
  }, [ready]);

  const cloudBackupNow = useCallback(async () => {
    const snap = await buildSnapshot(storeRef.current);
    return pushSnapshotToICloud(JSON.stringify(snap));
  }, []);

  const cloudRestore = useCallback(async () => {
    const raw = await pullSnapshotFromICloud();
    if (!raw) return null;
    const r = await applySnapshot(raw, storeRef.current);
    if (r.store) update(() => r.store!);
    return { mindKeys: r.mindKeys, shape: r.shape };
  }, [update]);

  const restoreFromJson = useCallback(
    async (json: string) => {
      const r = await applySnapshot(json, storeRef.current);
      if (r.store) update(() => r.store!);
      return { mindKeys: r.mindKeys, shape: r.shape };
    },
    [update]
  );

  const syncNow = useCallback(async () => {
    if (!(await isCloudAvailable())) {
      setSyncState('unavailable');
      return;
    }
    setSyncState('syncing');
    const cloud = await pullFromCloud();
    const merged = cloud ? mergeStores(store, cloud) : store;
    if (cloud && storeDiffers(merged, store)) {
      setStore(merged);
      void saveStore(merged);
    }
    if (merged.profile !== null && (!cloud || storeDiffers(merged, cloud))) {
      await pushToCloud(merged);
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
        setAppMode,
        setJointFeel,
        setPushMax,
        completePushSession,
        editPushSession,
        deletePushSession,
        restorePushSession,
        emptyPushTrash,
        setSupplementStatus,
        setSupplementContext,
        saveSupItem,
        setSupItemActive,
        importStore,
        resetAll,
        syncNow,
        cloudBackupNow,
        cloudRestore,
        restoreFromJson,
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
