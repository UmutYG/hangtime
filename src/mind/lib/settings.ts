import AsyncStorage from "@react-native-async-storage/async-storage";

// What this room stores about itself. It used to also hold the vision board
// (cards, an archive of dissolved ones, and a freeform "dream portrait") and
// a language choice. The board is gone — the room's only job is noticing what
// is already good — and the app is English, so the key is now just the API
// key that writes the recaps.
export type Settings = {
  apiKey: string; // Anthropic API key, stored on-device only
};

const KEY = "settings:v3";

export const defaultSettings: Settings = {
  apiKey: "",
};

export async function loadSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) return { ...defaultSettings, ...JSON.parse(raw) };

    // One-time lift of the API key out of the old v2 shape, so removing the
    // vision board doesn't silently cost the key that pays for the recaps.
    const legacy = await AsyncStorage.getItem("settings:v2");
    if (legacy) {
      const parsed = JSON.parse(legacy);
      const carried: Settings = {
        apiKey: typeof parsed?.apiKey === "string" ? parsed.apiKey : "",
      };
      await AsyncStorage.setItem(KEY, JSON.stringify(carried));
      return carried;
    }
  } catch {}
  return defaultSettings;
}

export async function persistSettings(s: Settings): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
}
