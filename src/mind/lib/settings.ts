import AsyncStorage from "@react-native-async-storage/async-storage";
import { Lang } from "./i18n";

export type VisionCard = {
  id: string;
  text: string; // identity statement — "who I am becoming"
  tint: number; // index into cardTints (still used for full-screen recap/reel washes)
  createdAt: number;
};

export type Settings = {
  language: Lang;
  visionCards: VisionCard[];
  // Slides that have dissolved into character (per the book: once it feels
  // ordinary and yours, the slide has done its work). Restorable any time.
  archivedVisions: VisionCard[];
  // Freeform portrait of the person they are becoming — the target slide in
  // their own words, embellished with more detail whenever they feel like
  // it. Feeds the inner map so everything the mirror says grows sharper as
  // the portrait does. Never required, never prompted for.
  dreamPortrait: string;
  apiKey: string; // Anthropic API key, stored on-device only
};

const KEY = "settings:v2";

// English is the default voice: AI generation is native-quality in English,
// while Turkish needs constant register-calibration work. Turkish remains a
// full first-class mode, switchable in Settings — kept alive deliberately
// for Ahsen (the app's tester).
export const defaultSettings: Settings = {
  language: "en",
  visionCards: [],
  archivedVisions: [],
  dreamPortrait: "",
  apiKey: "",
};

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function newCard(text: string, tint: number): VisionCard {
  return { id: makeId(), text, tint, createdAt: Date.now() };
}

export async function loadSettings(): Promise<Settings> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) {
    // migrate from v1 (flat identities[] + dream string)
    const v1 = await AsyncStorage.getItem("settings:v1");
    if (v1) {
      try {
        const old = JSON.parse(v1);
        return {
          ...defaultSettings,
          language: "tr",
          visionCards: (old.identities ?? []).map((t: string, i: number) => ({
            id: `mig-${i}`,
            text: t,
            tint: i % 5,
            createdAt: Date.now(),
          })),
        };
      } catch {
        // fall through
      }
    }
    return defaultSettings;
  }
  try {
    const parsed = JSON.parse(raw);
    const merged: Settings = { ...defaultSettings, ...parsed };
    // Migration from the Turkish-only era (language was force-set to "tr"
    // on every load until 2026-07-16): an EXISTING install with no stored
    // language was living in Turkish — keep it that way instead of letting
    // the new English default silently flip them. Only fresh installs (no
    // stored settings at all) start in English.
    if (parsed.language !== "tr" && parsed.language !== "en") {
      merged.language = "tr";
    }
    return merged;
  } catch {
    return defaultSettings;
  }
}

export async function persistSettings(s: Settings): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(s));
}
