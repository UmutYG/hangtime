import { Platform } from 'react-native';
import { normalizeDistanceKm, Run } from '../engine/runs';

// Apple Health bridge via @kingstinct/react-native-healthkit (new-architecture
// native module). Only exists in real builds (TestFlight / dev-client) — in
// Expo Go the require fails and the running module degrades to manual logging.

let HK: any = null;
try {
  if (Platform.OS === 'ios') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    HK = require('@kingstinct/react-native-healthkit');
  }
} catch {
  HK = null;
}

export function isHealthModuleAvailable(): boolean {
  try {
    return (
      HK !== null &&
      typeof HK.queryWorkoutSamples === 'function' &&
      HK.isHealthDataAvailable() === true
    );
  } catch {
    return false;
  }
}


/** Ask the user for read access (iOS shows the Health permission sheet once). */
export async function requestHealthAuth(): Promise<boolean> {
  if (!isHealthModuleAvailable()) return false;
  try {
    return (
      (await HK.requestAuthorization({
        toRead: [
          'HKWorkoutTypeIdentifier',
          'HKQuantityTypeIdentifierDistanceWalkingRunning',
          'HKQuantityTypeIdentifierHeartRate',
          'HKQuantityTypeIdentifierActiveEnergyBurned',
        ],
      })) === true
    );
  } catch {
    return false;
  }
}

const RUNNING_ACTIVITY = 37; // WorkoutActivityType.running

/** distance Quantity → km, trusting the unit string when present */
function quantityToKm(q: { unit?: string; quantity?: number } | undefined): number {
  if (!q || !Number.isFinite(q.quantity)) return 0;
  const v = Number(q.quantity);
  const unit = (q.unit ?? '').toLowerCase();
  if (unit === 'km') return Math.round(v * 100) / 100;
  if (unit === 'm') return Math.round((v / 1000) * 100) / 100;
  if (unit === 'mi') return Math.round(v * 1.60934 * 100) / 100;
  return normalizeDistanceKm(v); // unknown unit → size heuristic
}

/** All running workouts in Health (any source app), mapped to our Run shape. */
export async function fetchRunsFromHealth(): Promise<Run[]> {
  if (!isHealthModuleAvailable()) return [];
  try {
    const workouts: any[] = await HK.queryWorkoutSamples({
      limit: -1,
      ascending: true,
      filter: { workoutActivityType: RUNNING_ACTIVITY },
    });
    const runs: Run[] = [];
    for (const w of workouts ?? []) {
      const start = w.startDate ? new Date(w.startDate) : null;
      const end = w.endDate ? new Date(w.endDate) : null;
      if (!start || !end) continue;
      const durationSec =
        w.duration && Number.isFinite(w.duration.quantity) && w.duration.unit === 's'
          ? Math.round(w.duration.quantity)
          : Math.round((end.getTime() - start.getTime()) / 1000);
      const distanceKm = quantityToKm(w.totalDistance);
      if (durationSec < 120 || distanceKm < 0.3) continue; // ignore noise
      const calories = w.totalEnergyBurned?.quantity;
      runs.push({
        id: String(w.uuid ?? `${start.toISOString()}-${distanceKm}`),
        date: start.toISOString().slice(0, 10),
        distanceKm,
        durationSec,
        calories: Number.isFinite(calories) ? Math.round(Number(calories)) : undefined,
        source: 'health',
      });
    }
    return runs;
  } catch {
    return [];
  }
}
