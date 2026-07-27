import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActiveWorkout, sanitizeActiveWorkout } from '../engine/activeWorkout';

// Deliberately its own key, NOT part of the synced Store: a half-finished
// session is local to this device and must never travel to iCloud.
const KEY = 'hangtime.activeWorkout.v1';

export async function saveActiveWorkout(w: ActiveWorkout): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(w));
  } catch {
    // a failed snapshot must never interrupt the session in progress
  }
}

export async function loadActiveWorkout(): Promise<ActiveWorkout | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    return sanitizeActiveWorkout(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function clearActiveWorkout(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // nothing to do
  }
}
