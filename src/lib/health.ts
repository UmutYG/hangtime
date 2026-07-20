import { Platform } from 'react-native';
import { normalizeDistanceKm, Run } from '../engine/runs';

// Apple Health bridge via react-native-health. The native module only exists
// in real builds (TestFlight / dev-client) — in Expo Go the require fails and
// the running module degrades to manual logging.

let AppleHealthKit: any = null;
try {
  if (Platform.OS === 'ios') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('react-native-health');
    AppleHealthKit = mod.default ?? mod;
  }
} catch {
  AppleHealthKit = null;
}

export function isHealthModuleAvailable(): boolean {
  return AppleHealthKit !== null && typeof AppleHealthKit.initHealthKit === 'function';
}

const PERMS = () => ({
  permissions: {
    read: [
      AppleHealthKit.Constants.Permissions.Workout,
      AppleHealthKit.Constants.Permissions.DistanceWalkingRunning,
      AppleHealthKit.Constants.Permissions.HeartRate,
      AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
    ],
    write: [],
  },
});

/** Ask the user for read access (iOS shows the Health permission sheet once). */
export function requestHealthAuth(): Promise<boolean> {
  return new Promise((resolve) => {
    if (!isHealthModuleAvailable()) return resolve(false);
    try {
      AppleHealthKit.initHealthKit(PERMS(), (error: unknown) => resolve(!error));
    } catch {
      resolve(false);
    }
  });
}

const RUNNING_NAMES = new Set(['Running', 'RunningSand', 'RunningTreadmill']);

/** All running workouts in Health (any source app), mapped to our Run shape. */
export function fetchRunsFromHealth(): Promise<Run[]> {
  return new Promise((resolve) => {
    if (!isHealthModuleAvailable()) return resolve([]);
    const options = {
      startDate: new Date(2000, 0, 1).toISOString(),
      endDate: new Date().toISOString(),
      type: 'Workout',
    };
    try {
      AppleHealthKit.getSamples(options, (error: unknown, results: any[]) => {
        if (error || !Array.isArray(results)) return resolve([]);
        const runs: Run[] = [];
        for (const w of results) {
          const activity = String(w.activityName ?? w.activityId ?? '');
          if (!RUNNING_NAMES.has(activity)) continue;
          const start = w.start ?? w.startDate;
          const end = w.end ?? w.endDate;
          if (!start || !end) continue;
          const durationSec = Math.round(
            (new Date(end).getTime() - new Date(start).getTime()) / 1000
          );
          const distanceKm = normalizeDistanceKm(Number(w.distance ?? 0));
          if (durationSec < 120 || distanceKm < 0.3) continue; // ignore noise
          runs.push({
            id: String(w.id ?? `${start}-${distanceKm}`),
            date: String(start).slice(0, 10),
            distanceKm,
            durationSec,
            calories: w.calories ? Math.round(Number(w.calories)) : undefined,
            source: 'health',
          });
        }
        resolve(runs);
      });
    } catch {
      resolve([]);
    }
  });
}
