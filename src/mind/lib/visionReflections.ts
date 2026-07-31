import AsyncStorage from "@react-native-async-storage/async-storage";
import { dateKey } from "./dates";

// Quietly logged answers to occasional "why this vision?" questions. The point
// is the asking (catching goals you've adopted from others, per Reality
// Transurfing) — the answers are kept but never need to be shown.
export type VisionReflection = {
  id: string;
  cardId: string;
  question: string;
  answer: string;
  createdAt: number;
};

const KEY = "visionReflections:v1";
const LAST_ASKED = "visionWhyLastAsked"; // date string, to ask at most once a day

export async function getVisionReflections(): Promise<VisionReflection[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function saveVisionReflection(r: VisionReflection): Promise<void> {
  const list = await getVisionReflections();
  list.unshift(r);
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
}

// The ask now comes up to twice a day (morning / afternoon-evening) — the
// questions are the app's main listening channel, and their answers feed the
// mirror feed, notifications and recaps, so a higher cadence keeps the whole
// app evolving with the person.
function periodKey(): string {
  return `${dateKey()}:${new Date().getHours() < 14 ? "am" : "pm"}`;
}

export async function askedToday(): Promise<boolean> {
  const last = await AsyncStorage.getItem(LAST_ASKED);
  return last === periodKey();
}

export async function markAskedToday(): Promise<void> {
  await AsyncStorage.setItem(LAST_ASKED, periodKey());
}

// How many times each card has been reflected on — used to ask about the
// least-examined vision first.
export async function reflectionCounts(): Promise<Record<string, number>> {
  const list = await getVisionReflections();
  const counts: Record<string, number> = {};
  for (const r of list) counts[r.cardId] = (counts[r.cardId] ?? 0) + 1;
  return counts;
}
