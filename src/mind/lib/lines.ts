import AsyncStorage from "@react-native-async-storage/async-storage";
import { Lang } from "./i18n";
import { generateMirrorLines } from "./claude";
import { buildInnerNotes } from "./innerMap";
import { normalizeLines } from "./text";

const CACHE_KEY = "mirrorThanks:v1";
const TTL = 7 * 24 * 60 * 60 * 1000; // refresh weekly

// The self-renewing pool of "you drew closer to the mirror" lines: same
// motivation, fresh words every week. Cached so a whole week of answers
// costs one cheap generation; the static i18n lines remain the floor when
// there's no key or the network fails. Seasoned by the mental map (the
// user's own reflection answers) — the app evolves with the person.
export async function getMirrorThanksLines(
  lang: Lang,
  apiKey: string,
  fallback: string[]
): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) {
      const c = JSON.parse(raw);
      if (c.lang === lang && Date.now() - c.createdAt < TTL && c.lines?.length >= 4) {
        return c.lines;
      }
    }
  } catch {}

  let lines = fallback;
  if (apiKey) {
    try {
      const notes = await buildInnerNotes().catch(() => []);
      const gen = await generateMirrorLines(apiKey, lang, 8, notes);
      if (gen.length >= 4) lines = normalizeLines(gen);
    } catch {
      // keep fallback
    }
  }
  AsyncStorage.setItem(
    CACHE_KEY,
    JSON.stringify({ lang, lines, createdAt: Date.now() })
  ).catch(() => {});
  return lines;
}
