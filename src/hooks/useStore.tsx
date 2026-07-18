import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { applyResult } from '../engine/stateMachine';
import { LoggedSession, Profile, Store } from '../engine/types';
import { initialState } from '../engine/generator';
import { emptyStore, importJson, loadStore, saveStore } from '../lib/storage';

interface StoreApi {
  store: Store;
  ready: boolean;
  createProfile: (p: Profile) => void;
  updateProfile: (patch: Partial<Profile>) => void;
  completeSession: (session: LoggedSession) => { prCount: number };
  importStore: (json: string) => boolean;
  resetAll: () => void;
}

const Ctx = createContext<StoreApi | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [store, setStore] = useState<Store>(emptyStore());
  const [ready, setReady] = useState(false);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadStore().then((s) => {
      setStore(s);
      setReady(true);
    });
  }, []);

  const persist = useCallback((s: Store) => {
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => void saveStore(s), 150);
  }, []);

  const update = useCallback(
    (fn: (s: Store) => Store) => {
      setStore((prev) => {
        const next = fn(prev);
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

  return (
    <Ctx.Provider
      value={{ store, ready, createProfile, updateProfile, completeSession, importStore, resetAll }}
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
