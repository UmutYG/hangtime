import AsyncStorage from "@react-native-async-storage/async-storage";

// "Pozitif Yönlerim" — strengths the user already has. The inward twin of
// Flow: Flow collects the world's positive signs, this collects your own.
// Deliberately a quiet list: writing a strength down once is enough — it
// feeds the inner map so reflections quietly know these sides of the
// person. (The per-strength "sightings" ritual was removed 2026-07-16 as
// cognitive load; old notes are kept in the store and still read by the
// inner map, they just stop growing.) Growth areas don't live here —
// that's Vision's job (who you are BECOMING); this page is who you ARE.
export type Strength = {
  id: string;
  text: string; // the trait itself — "Sabırlıyım", "İyi dinlerim"
  createdAt: number;
};

export type StrengthNote = {
  id: string;
  strengthId: string;
  text: string; // the sighting — where it showed up today
  date: string; // YYYY-MM-DD
  createdAt: number;
};

type Store = { strengths: Strength[]; notes: StrengthNote[] };

const KEY = "strengths:v1"; // auto-covered by the generic cloud backup

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

async function load(): Promise<Store> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return { strengths: [], notes: [] };
  try {
    const parsed = JSON.parse(raw);
    return { strengths: parsed.strengths ?? [], notes: parsed.notes ?? [] };
  } catch {
    return { strengths: [], notes: [] };
  }
}

async function save(store: Store): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(store));
}

export async function getStrengthStore(): Promise<Store> {
  const store = await load();
  store.strengths.sort((a, b) => a.createdAt - b.createdAt); // stable, oldest first
  store.notes.sort((a, b) => b.createdAt - a.createdAt); // newest sightings first
  return store;
}

export async function addStrength(text: string): Promise<Strength> {
  const store = await load();
  const s: Strength = { id: makeId(), text, createdAt: Date.now() };
  store.strengths.push(s);
  await save(store);
  return s;
}

export async function updateStrength(id: string, text: string): Promise<void> {
  const store = await load();
  store.strengths = store.strengths.map((s) => (s.id === id ? { ...s, text } : s));
  await save(store);
}

// Deleting a strength also drops its old sightings — it's only reachable
// from inside the edit popup (a deliberate second step), never one-tap.
export async function deleteStrength(id: string): Promise<void> {
  const store = await load();
  store.strengths = store.strengths.filter((s) => s.id !== id);
  store.notes = store.notes.filter((n) => n.strengthId !== id);
  await save(store);
}
