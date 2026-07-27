import { useMemo } from 'react';
import {
  buildLoadEntries,
  computeReadiness,
  LoadEntry,
  Modality,
  ReadinessResult,
  weeklyLoad,
  WeeklyLoad,
} from '../engine/load';
import { paceSecPerKm } from '../engine/runs';
import { JointFeel } from '../engine/types';
import { useStore } from './useStore';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** One unified timeline across all three spaces — the app's shared body model. */
export function useLoadEntries(): LoadEntry[] {
  const { store } = useStore();
  return useMemo(() => {
    let bestPace: number | null = null;
    for (const r of store.runs) {
      if (r.distanceKm < 2) continue;
      const p = paceSecPerKm(r);
      if (p !== null && (bestPace === null || p < bestPace)) bestPace = p;
    }
    return buildLoadEntries(store.sessions, store.pushSessions, store.runs, bestPace);
  }, [store.sessions, store.pushSessions, store.runs]);
}

/** Today's joint check-in, if the user answered it. */
export function useJointFeel(): JointFeel | null {
  const { store } = useStore();
  const today = todayIso();
  return useMemo(
    () => store.jointLog?.find((j) => j.date === today)?.feel ?? null,
    [store.jointLog, today]
  );
}

export function useReadiness(modality: Modality): ReadinessResult {
  const { store } = useStore();
  const entries = useLoadEntries();
  const joints = useJointFeel();
  return useMemo(
    () => computeReadiness(modality, entries, todayIso(), store.externalReadiness ?? null, joints),
    [modality, entries, store.externalReadiness, joints]
  );
}

export function useWeeklyLoad(): WeeklyLoad {
  const entries = useLoadEntries();
  return useMemo(() => weeklyLoad(entries, todayIso()), [entries]);
}
