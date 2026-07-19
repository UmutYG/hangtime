import React, { createContext, useCallback, useContext, useState } from 'react';
import { Readiness, SessionPlan } from '../engine/types';

interface WorkoutApi {
  activePlan: SessionPlan | null;
  activeReadiness: Readiness | undefined;
  start: (plan: SessionPlan, readiness: Readiness | undefined) => void;
  end: () => void;
}

const Ctx = createContext<WorkoutApi | null>(null);

// Lifted above the tab bar so starting a session can hide it entirely,
// matching the design's full-screen workout overlay.
export function WorkoutProvider({ children }: { children: React.ReactNode }) {
  const [activePlan, setActivePlan] = useState<SessionPlan | null>(null);
  const [activeReadiness, setActiveReadiness] = useState<Readiness | undefined>();

  const start = useCallback((plan: SessionPlan, readiness: Readiness | undefined) => {
    setActivePlan(plan);
    setActiveReadiness(readiness);
  }, []);
  const end = useCallback(() => {
    setActivePlan(null);
    setActiveReadiness(undefined);
  }, []);

  return (
    <Ctx.Provider value={{ activePlan, activeReadiness, start, end }}>{children}</Ctx.Provider>
  );
}

export function useWorkout(): WorkoutApi {
  const api = useContext(Ctx);
  if (!api) throw new Error('useWorkout outside WorkoutProvider');
  return api;
}
