import { PositiveEvent } from "./events";

// Haiku is fast and cheap — good enough for generation tasks.
const MATCH_MODEL = "claude-haiku-4-5";
// Matching an event to the right identity is subtle and was getting it wrong,
// so it gets a smarter model.
const SMART_MODEL = "claude-sonnet-4-6";
const API_URL = "https://api.anthropic.com/v1/messages";

export type RecapSection = {
  visionId: string | null;
  title: string;
  narrative: string;
  points: string[];
};
export type RecapData = { sections: RecapSection[]; closing: string };

export class NoApiKeyError extends Error {
  constructor() {
    super("no-api-key");
    this.name = "NoApiKeyError";
  }
}

// Every request gets a hard deadline. On mobile networks a request can hang
// without ever erroring, which used to leave sheets stuck on their loading
// state forever — and one hung background call could wedge the notification
// scheduler's inFlight guard for the whole process lifetime. Hermes has no
// AbortSignal.timeout/any, so this is the manual equivalent, merged with an
// optional caller signal (e.g. DailyRecap's cancel button).
//
// The deadline is per-call: the default fits the small matching-style calls,
// but the big non-streaming generations (recaps at 2k-8k tokens, mirror feed)
// legitimately run for minutes — a one-size 20s cap was silently killing the
// daily recap mid-write and bouncing the user back to the confirm screen.
//
// A deadline expiring throws TimeoutError, NOT AbortError: callers use
// AbortError to mean "the user cancelled, return quietly" and must be able
// to tell a genuine timeout apart so it surfaces as an error instead.
const REQUEST_TIMEOUT_MS = 20_000;

async function fetchWithTimeout(
  url: string,
  options: { method: string; headers: Record<string, string>; body: string },
  signal?: AbortSignal,
  timeoutMs: number = REQUEST_TIMEOUT_MS
): Promise<Response> {
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, timeoutMs);
  const onUpstreamAbort = () => ctrl.abort();
  if (signal) {
    if (signal.aborted) ctrl.abort();
    else signal.addEventListener("abort", onUpstreamAbort);
  }
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } catch (e) {
    if (timedOut && !signal?.aborted) {
      const err = new Error(`timeout after ${Math.round(timeoutMs / 1000)}s`);
      err.name = "TimeoutError";
      throw err;
    }
    throw e;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onUpstreamAbort);
  }
}

/**
 * The weekly pool of notification lines.
 *
 * The grounding ideas below used to be injected as sourced quotations from a
 * citations file, and coloured further by an "inner map" built from the vision
 * board and strengths list. Both are gone; the ideas remain here as plain
 * prose, which is all the prompt ever needed — the lines were never allowed to
 * quote or name a source anyway.
 */
export async function generateHeartfeltReminders(
  apiKey: string,
  n: number
): Promise<string[]> {
  if (!apiKey) throw new NoApiKeyError();

  const system =
    `Generate ${n} very short notification lines. Write the way a close, ` +
    "casual friend would text — everyday spoken language, never bookish or " +
    "self-help vocabulary. Calibration — match this exact register and " +
    "directness, never reuse these lines verbatim:\n" +
    '"Something good happened today and you probably forgot it already. Didn\'t have to. Who\'s stopping you?"\n' +
    '"Even three seconds — relive that good feeling, why not?"\n\n' +
    "Two blended registers, roughly half each, mixed in no fixed order, " +
    "never labeled:\n\n" +
    "REGISTER A — quiet agency over attention, right now: the felt " +
    "realization that nothing, in this exact moment, is stopping you from " +
    "holding a good moment a few seconds longer, from returning to it, from " +
    "choosing what your attention rests on. Casual, direct, sometimes a " +
    "light 'who's stopping you' dare. STRICTLY FORBIDDEN: guilt-flavored " +
    "comparisons with negativity ('if it were bad you'd have told three " +
    "people', 'you never forget what went wrong') — no scolding, no teasing " +
    "the reader about their habits, ever.\n\n" +
    "REGISTER B — the same casual, spoken voice landing ONE idea at a time: " +
    "whatever's looming in your head is bigger there than it is in reality; " +
    "a calm person gives worry nothing to hook into; only this breath is " +
    "actually happening; and you can decide, right in the moment a snag " +
    "appears, that everything is unfolding as it should — including this — " +
    "and watch it become part of the right road. Never mystical, lecture-y, " +
    "or abstract — the idea has to land as something completely ordinary and " +
    "immediate, said the way you'd actually text a friend, not summarize a " +
    "concept.\n\n" +
    "Whichever register: never generic ('stay positive'), never preachy, " +
    "never task-like, no exclamation marks. Every single line must end with " +
    "real terminal punctuation — a period, question mark, or ellipsis — " +
    "never left hanging with no mark at all. " +
    "Each under ~130 characters, no numbering, no quotes.";

  const res = await fetchWithTimeout(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: MATCH_MODEL,
      max_tokens: 900,
      system,
      messages: [{ role: "user", content: `Write the ${n} reminders now.` }],
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: { lines: { type: "array", items: { type: "string" } } },
            required: ["lines"],
            additionalProperties: false,
          },
        },
      },
    }),
  }, undefined, 60_000);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Claude API ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const out = data?.content?.find((b: any) => b.type === "text")?.text ?? "{}";
  const lines: string[] = JSON.parse(out).lines ?? [];
  return lines.map((l) => l.trim()).filter(Boolean);
}

// A warm, Spotify-Wrapped-style recap. Groups the noticed moments under the
// visions they belong to and reflects back "who you're becoming" — a fluid
// review, not a quiz. Shared by the weekly recap (past, completed weeks) and
// the same-day recap (today, cached and re-picked-up on demand).
/**
 * The recap: the day (or week) read back as evidence.
 *
 * It used to group moments under the user's vision cards. With the vision
 * board gone the model finds the groupings itself from the moments alone —
 * which is closer to the point anyway: the themes come out of what actually
 * happened, not out of a wall of identities to live up to.
 */
async function buildRecap(
  apiKey: string,
  events: PositiveEvent[],
  period: "day" | "week",
  signal?: AbortSignal
): Promise<RecapData> {
  if (!apiKey) throw new NoApiKeyError();
  const periodLabel = period === "week" ? "weekly" : "same-day";
  const momentsLabel = period === "week" ? "This week's moments" : "Today's moments";
  const moments = events.map((e) => `- ${e.text.trim()}`).join("\n");

  // The weekly recap is the once-a-week full replay: every single moment gets
  // reflected back (that's the whole point of the review — systematic
  // repetition of real evidence), so its point lists are exhaustive and its
  // token ceiling much higher. The daily recap stays a light skim.
  const pointsRule =
    period === "week"
      ? "then list EVERY moment belonging to it as its own point — do not " +
        "summarize several into one, do not skip any, oldest to newest. " +
        "Lightly polish each into one warm, concrete line that still clearly " +
        "names the real moment. The user scrolls; completeness matters more " +
        "than brevity. "
      : "then 2-4 concise key points drawn from the real moments (reframed, " +
        "encouraging). ";

  const system =
    `You create a warm, Spotify-Wrapped-style ${periodLabel} recap for someone ` +
    "practising noticing what is already good in their life. Read " +
    `${momentsLabel.toLowerCase()} and group them into a small number of ` +
    "themes you find in the moments themselves — two to four for a day, more " +
    "for a week — and title each theme in a few plain words. For each theme " +
    "write a short narrative (2-3 sentences, second person, present tense) " +
    "about what it shows, " +
    pointsRule +
    "Alive and warm, never robotic or task-like. End with one short, freeing " +
    "closing line. Never invent a moment that is not in the list. Leave " +
    "visionId as an empty string on every section.";

  const user =
    `${momentsLabel}:\n${moments || "- (none)"}\n\nWrite the recap now.`;

  const res = await fetchWithTimeout(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: SMART_MODEL,
      max_tokens: period === "week" ? 8000 : 2000,
      system,
      messages: [{ role: "user", content: user }],
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              sections: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    visionId: { type: "string" },
                    title: { type: "string" },
                    narrative: { type: "string" },
                    points: { type: "array", items: { type: "string" } },
                  },
                  required: ["visionId", "title", "narrative", "points"],
                  additionalProperties: false,
                },
              },
              closing: { type: "string" },
            },
            required: ["sections", "closing"],
            additionalProperties: false,
          },
        },
      },
    }),
  }, signal, period === "week" ? 240_000 : 120_000);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Claude API ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const out = data?.content?.find((b: any) => b.type === "text")?.text ?? "{}";
  const parsed = JSON.parse(out);
  const sections: RecapSection[] = (parsed.sections ?? []).map((s: any) => ({
    visionId: null,
    title: s.title ?? "",
    narrative: s.narrative ?? "",
    points: s.points ?? [],
  }));
  return { sections, closing: parsed.closing ?? "" };
}

export async function generateWeeklyRecap(
  apiKey: string,
  events: PositiveEvent[],
  signal?: AbortSignal
): Promise<RecapData> {
  return buildRecap(apiKey, events, "week", signal);
}

export async function generateDailyRecap(
  apiKey: string,
  events: PositiveEvent[],
  signal?: AbortSignal
): Promise<RecapData> {
  return buildRecap(apiKey, events, "day", signal);
}

// The weekly "voice pack": every micro-line the app speaks in passing —
// the morning echo of yesterday and the evening invite — generated in ONE
// cheap call so nothing in the app ever reads as a fixed script. Sets that
// wrap the person's own words carry a literal {moment} placeholder the app
// fills at send time. Statics remain the offline floor (voicePack.ts
// validates per set and falls back field by field).
//
// This used to carry four more sets (momentum, resurface, dwell, nudge) for
// notifications that no longer exist — the day is a fixed morning/midday/
// evening now, with nothing firing per log, so the pack only writes for the
// two slots that still speak in the person's own words.
export type VoicePack = {
  echo: string[]; // morning, wraps yesterday's moment — needs {moment}
  invites: string[]; // evening "leave one thing here" notification
};

export async function generateVoicePack(
  apiKey: string,
): Promise<VoicePack> {
  if (!apiKey) throw new NoApiKeyError();
  const system =
    "You write the tiny passing lines of a warm companion app built around " +
    "one stance: nothing, right now, stops you from resting your attention " +
    "on what's already good. Write the way a close, casual friend would " +
    "text — everyday spoken language, never bookish or self-help vocabulary. " +
    "Calibration — match this exact register and directness, never reuse " +
    "these lines verbatim (shown here without the {moment} placeholder, " +
    "which sets below use):\n" +
    '"Something good happened today and you probably forgot it already. Didn\'t have to. Who\'s stopping you?"\n' +
    '"Even three seconds — relive that good feeling, why not?"\n\n' +
    "One intimate voice across both sets — a present friend, not a coach, " +
    "but a friend with a spine: the lines hold space rather than instruct, " +
    "and never compare the person to some hypothetical worse reaction ('if " +
    "it were bad you'd have told three people' — never that move, ever). " +
    "Rhetorical 'who's stopping you' questions are welcome. No exclamation " +
    "marks; every line ends with real terminal punctuation; each under " +
    "~120 characters, no numbering, no surrounding quotes. Sets marked " +
    "with {moment} wrap the person's OWN words: those lines must contain " +
    "the literal placeholder {moment} exactly once — it will be replaced " +
    "with their words in quotation marks, so write around it naturally " +
    "and add no quotes of your own.\n\n" +
    "Sets:\n" +
    "- echo (4): a morning line wrapping {moment} = something they noticed " +
    "YESTERDAY — the light of it is still theirs, today's is still unnamed.\n" +
    "- invites (5): an evening line inviting them to leave one small good " +
    "thing from the day; warm, tiny, zero pressure; no placeholder.";

  const res = await fetchWithTimeout(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: MATCH_MODEL,
      max_tokens: 2000,
      system,
      messages: [{ role: "user", content: "Write the full voice pack now." }],
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              echo: { type: "array", items: { type: "string" } },
              invites: { type: "array", items: { type: "string" } },
            },
            required: ["echo", "invites"],
            additionalProperties: false,
          },
        },
      },
    }),
  }, undefined, 90_000);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Claude API ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const out = data?.content?.find((b: any) => b.type === "text")?.text ?? "{}";
  const parsed = JSON.parse(out);
  const clean = (a: any): string[] =>
    Array.isArray(a) ? a.map((l: any) => String(l).trim()).filter(Boolean) : [];
  return {
    echo: clean(parsed.echo),
    invites: clean(parsed.invites),
  };
}
