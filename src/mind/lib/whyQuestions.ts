import AsyncStorage from "@react-native-async-storage/async-storage";
import { Lang } from "./i18n";
import { generateWhyQuestions } from "./claude";
import { buildInnerNotes } from "./innerMap";
import { normalizeLines } from "./text";
import { VisionCard } from "./settings";

const CACHE_KEY = "whyQuestions:v1";
const TTL = 7 * 24 * 60 * 60 * 1000; // refresh weekly, like every other pool

// The self-renewing pool of "is this vision really yours?" questions: the
// asking itself now evolves with the person instead of rotating a fixed
// list. Cached so a whole week of daily asks costs one cheap generation;
// the static i18n q1..q10 remain the floor when there's no key or the
// network fails. Shaped by the inner map — the mirror asking about what it
// has quietly learned matters to this person, never quoting it.
//
// The cache is keyed to the wall's fingerprint as well as the week: a pool
// generated around last week's visions must not survive an archive/add/edit
// — that's how questions ended up echoing archived visions beneath a brand
// new one.
export async function getWhyQuestions(
  lang: Lang,
  apiKey: string,
  fallback: string[],
  cards: VisionCard[] = []
): Promise<string[]> {
  const sig = cards.map((c) => `${c.id}:${c.text}`).join("|");
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) {
      const c = JSON.parse(raw);
      if (
        c.lang === lang &&
        c.sig === sig &&
        Date.now() - c.createdAt < TTL &&
        c.lines?.length >= 6
      ) {
        return c.lines;
      }
    }
  } catch {}

  let lines = fallback;
  if (apiKey) {
    try {
      const notes = await buildInnerNotes().catch(() => []);
      const gen = await generateWhyQuestions(
        apiKey,
        lang,
        12,
        notes,
        cards.map((c) => c.text)
      );
      if (gen.length >= 6) lines = normalizeLines(gen);
    } catch {
      // keep fallback
    }
  }
  AsyncStorage.setItem(
    CACHE_KEY,
    JSON.stringify({ lang, sig, lines, createdAt: Date.now() })
  ).catch(() => {});
  return lines;
}
