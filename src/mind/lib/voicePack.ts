import AsyncStorage from "@react-native-async-storage/async-storage";
import { Lang } from "./i18n";
import { generateVoicePack, VoicePack } from "./claude";
import { buildInnerNotes } from "./innerMap";
import { normalizeLines } from "./text";

// v2: the voice went casual/spoken instead of translated-English-idiom
// (2026-07-16) — bumping orphans any v1 pool so stiff old lines can't keep
// serving for up to a week after the update.
// v3: resurface timing went random (2026-07-20) — cached v2 resurface lines
// still say "a minute ago", which the new unpredictable delay makes untrue.
// v4: the pack shrank to echo + invites (2026-08-03) — a cached v3 entry
// would otherwise keep a week's worth of lines written for notifications
// that no longer fire.
const CACHE_KEY = "voicePack:v4";
const TTL = 7 * 24 * 60 * 60 * 1000; // refresh weekly, like every other pool

// Minimum usable size per set — a set that comes back too thin (or, for the
// placeholder sets, with the {moment} token missing) is dropped to [] and
// its consumer falls back to the static lines. Field-by-field: one bad set
// never takes the whole pack down.
const MIN: Record<keyof VoicePack, number> = {
  echo: 3,
  invites: 4,
};
const NEEDS_PLACEHOLDER: (keyof VoicePack)[] = ["echo"];

const EMPTY: VoicePack = {
  echo: [],
  invites: [],
};

function validate(raw: Partial<VoicePack>): VoicePack {
  const pack: VoicePack = { ...EMPTY };
  for (const key of Object.keys(MIN) as (keyof VoicePack)[]) {
    let lines = normalizeLines(raw[key] ?? []);
    if (NEEDS_PLACEHOLDER.includes(key)) {
      lines = lines.filter((l) => l.split("{moment}").length === 2);
    }
    pack[key] = lines.length >= MIN[key] ? lines : [];
  }
  return pack;
}

// Fill a placeholder line with the person's own words, quoted — the same
// «"…"» framing the static template pools use.
export function fillMoment(line: string, moment: string): string {
  return line.replace("{moment}", `“${moment}”`);
}

// The weekly self-renewing voice: every passing micro-line the app speaks,
// generated in one cheap call and shaped by the inner map, so nothing ever
// reads as a fixed script. Without a key (or on any failure) every set is
// empty and consumers stay on their static floors — the app never breaks,
// it just speaks in its original voice.
let inFlight: Promise<VoicePack> | null = null;

export async function getVoicePack(lang: Lang, apiKey: string): Promise<VoicePack> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) {
      const c = JSON.parse(raw);
      if (c.lang === lang && Date.now() - c.createdAt < TTL && c.pack) {
        return validate(c.pack);
      }
    }
  } catch {}

  if (!apiKey) return EMPTY;

  // The scheduler can be asked for the pack more than once in a session
  // (mount, then a foreground); a cache-miss week start should still cost
  // exactly one generation.
  if (!inFlight) {
    inFlight = (async () => {
      try {
        const notes = await buildInnerNotes().catch(() => []);
        const gen = await generateVoicePack(apiKey, lang, notes);
        const pack = validate(gen);
        await AsyncStorage.setItem(
          CACHE_KEY,
          JSON.stringify({ lang, pack, createdAt: Date.now() })
        ).catch(() => {});
        return pack;
      } catch {
        return EMPTY; // statics carry the week; next open retries
      }
    })().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}
