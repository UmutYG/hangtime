import AsyncStorage from "@react-native-async-storage/async-storage";
import { dateKey, addDays } from "./dates";

// A positive event / synchronicity the user noticed on the way to their slide.
// Reality Transurfing: nourishing the positive keeps you on the wave of fortune.
export type PositiveEvent = {
  id: string;
  text: string;
  date: string; // YYYY-MM-DD
  createdAt: number;
  matchedCardId?: string; // vision card this event supports — set only on demand
  // (EditEventSheet's manual rematch), never automatically at log time.
  matchReason?: string; // short why, from Claude
};

const KEY = "events:v1";

// The list is kept sorted (newest first) as a WRITE-time invariant:
// addEvent unshifts with a monotonically increasing createdAt, and every
// other mutation preserves order. getEvents is the hottest read in the app
// (every foreground, every screen mount), so it must not re-sort the whole
// array on each call — that used to be an O(n log n) tax on a list that
// was already sorted.
export async function getEvents(): Promise<PositiveEvent[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as PositiveEvent[];
  } catch {
    return [];
  }
}

async function saveAll(list: PositiveEvent[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
}

// Safety valve for the unbounded-growth case: the weekly recap's "let the
// week go" is the intended prune, but a user who never opens it would keep
// every event forever — and pay the full JSON parse on every foreground.
// One year is deliberately generous: nothing a recap could still review is
// ever taken away silently. Called once per cold start from App.tsx.
const KEEP_DAYS = 365;

export async function pruneOldEvents(): Promise<void> {
  try {
    const cutoff = addDays(dateKey(), -KEEP_DAYS);
    const list = await getEvents();
    const kept = list.filter((e) => e.date >= cutoff);
    if (kept.length !== list.length) await saveAll(kept);
  } catch {
    // best-effort — never block startup over housekeeping
  }
}

export async function addEvent(e: PositiveEvent): Promise<void> {
  const list = await getEvents();
  list.unshift(e);
  await saveAll(list);
}

export async function updateEvent(
  id: string,
  patch: Partial<PositiveEvent>
): Promise<void> {
  const list = await getEvents();
  const next = list.map((e) => (e.id === id ? { ...e, ...patch } : e));
  await saveAll(next);
}

export async function deleteEvent(id: string): Promise<void> {
  const list = await getEvents();
  await saveAll(list.filter((e) => e.id !== id));
}

// Delete several events in one read-modify-write. Calling deleteEvent()
// repeatedly via Promise.all is a race — each call re-reads the same stale
// list and the last write wins, silently un-deleting the others.
export async function deleteEvents(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const set = new Set(ids);
  const list = await getEvents();
  await saveAll(list.filter((e) => !set.has(e.id)));
}

export async function eventsForCard(cardId: string): Promise<PositiveEvent[]> {
  const list = await getEvents();
  return list.filter((e) => e.matchedCardId === cardId);
}
