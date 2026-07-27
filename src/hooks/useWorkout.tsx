import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Readiness, SessionPlan } from '../engine/types';
import { ActiveWorkout, isResumable } from '../engine/activeWorkout';
import { clearActiveWorkout, loadActiveWorkout } from '../lib/activeWorkout';

interface WorkoutApi {
  activePlan: SessionPlan | null;
  activeReadiness: Readiness | undefined;
  /** progress to seed the overlay with when resuming an interrupted session */
  seed: ActiveWorkout | null;
  /** an interrupted session found on disk, offered on the owning mode's Today screen */
  pending: ActiveWorkout | null;
  start: (plan: SessionPlan, readiness: Readiness | undefined) => void;
  end: () => void;
  resume: () => void;
  discardPending: () => void;
}

const Ctx = createContext<WorkoutApi | null>(null);

// Lifted above the tab bar so starting a session can hide it entirely,
// matching the design's full-screen workout overlay.
export function WorkoutProvider({ children }: { children: React.ReactNode }) {
  const [activePlan, setActivePlan] = useState<SessionPlan | null>(null);
  const [activeReadiness, setActiveReadiness] = useState<Readiness | undefined>();
  const [seed, setSeed] = useState<ActiveWorkout | null>(null);
  const [pending, setPending] = useState<ActiveWorkout | null>(null);

  // an interrupted session from a previous app run — offered, never forced
  useEffect(() => {
    let alive = true;
    void (async () => {
      const found = await loadActiveWorkout();
      if (!alive) return;
      if (found && isResumable(found)) setPending(found);
      else if (found) await clearActiveWorkout(); // started but nothing logged
    })();
    return () => {
      alive = false;
    };
  }, []);

  const start = useCallback((plan: SessionPlan, readiness: Readiness | undefined) => {
    setSeed(null);
    setPending(null);
    setActivePlan(plan);
    setActiveReadiness(readiness);
  }, []);

  const end = useCallback(() => {
    setActivePlan(null);
    setActiveReadiness(undefined);
    setSeed(null);
    void clearActiveWorkout();
  }, []);

  const resume = useCallback(() => {
    setPending((p) => {
      if (p) {
        setSeed(p);
        setActivePlan(p.plan);
        setActiveReadiness(p.readiness);
      }
      return null;
    });
  }, []);

  const discardPending = useCallback(() => {
    setPending(null);
    void clearActiveWorkout();
  }, []);

  return (
    <Ctx.Provider
      value={{ activePlan, activeReadiness, seed, pending, start, end, resume, discardPending }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useWorkout(): WorkoutApi {
  const api = useContext(Ctx);
  if (!api) throw new Error('useWorkout outside WorkoutProvider');
  return api;
}
