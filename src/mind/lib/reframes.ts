import AsyncStorage from "@react-native-async-storage/async-storage";
import { dateKey } from "./dates";

// What the person brings to the reframe ritual is the most honest signal
// the app ever receives: what they call negative, WHY it weighs on them
// (their importance patterns), and the line they chose to keep. Until now
// all of it was discarded after the ritual — only the takeaway survived as
// a logged event. Kept here so the inner map (innerMap.ts) can let the
// mirror quietly know what tends to loom large for this person; never
// surfaced back verbatim anywhere.
export type ReframeEntry = {
  id: string;
  negative: string; // what they were seeing as negative, their words
  importanceAnswer: string; // why it mattered so much — the gold
  impactAnswer: string; // "would it sting without that importance?"
  takeaway: string; // the first-person line they chose to log
  date: string; // YYYY-MM-DD
  createdAt: number;
};

const KEY = "reframes:v1"; // auto-covered by the generic cloud backup

// Recent patterns are the useful ones; ancient episodes shouldn't keep
// coloring the mirror after the person has long moved past them.
const MAX_KEPT = 30;

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

async function load(): Promise<ReframeEntry[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function addReframe(
  e: Omit<ReframeEntry, "id" | "date" | "createdAt">
): Promise<void> {
  const list = await load();
  list.unshift({ ...e, id: makeId(), date: dateKey(), createdAt: Date.now() });
  await AsyncStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_KEPT)));
}

export async function getReframes(limit = 10): Promise<ReframeEntry[]> {
  const list = await load();
  return list.slice(0, limit); // stored newest first
}
