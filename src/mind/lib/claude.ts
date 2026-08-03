import { Lang } from "./i18n";
import { VisionCard } from "./settings";
import { PositiveEvent } from "./events";
import { byCategory, citationText } from "./citations";

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

// One card of the daily mirror feed — a corner for imagining your slide when
// you're too tired to do it yourself. "slide" speaks the vision as present
// reality; "ordinary" folds it into a mundane scene so it becomes
// commonplace. (Real noticed moments live in the recap features, not here.)
export type MirrorReel = {
  kind: "slide" | "ordinary";
  visionId: string | null;
  text: string;
};

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

// Ask Claude which vision card a logged positive event best supports, and —
// in the same call — whether it's also living proof of one of the person's
// own named strengths (their "Pozitif Yönlerim" list). Returns the matched
// card id (or null) plus a short, localized reason, and optionally a
// strength id + reaffirmation line.
export async function generateHeartfeltReminders(
  apiKey: string,
  lang: Lang,
  n: number,
  innerNotes: string[] = []
): Promise<string[]> {
  if (!apiKey) throw new NoApiKeyError();
  const language = lang === "tr" ? "Turkish" : "English";
  const notes = innerNotes.length
    ? "\n\nPrivate glimpses of how becoming their vision feels to this person " +
      "(let these quietly color a few lines; NEVER quote, reference or hint at " +
      "them directly):\n" + innerNotes.map((x) => `- ${x}`).join("\n")
    : "";
  const anchors = [...byCategory("importance"), ...byCategory("pendulum")]
    .map((c) => `- ${citationText(c, lang)}`)
    .join("\n");

  const system =
    `Generate ${n} very short notification lines. Write the way a close, ` +
    "casual friend would text — everyday spoken language. This is NOT a " +
    "translation exercise: don't compose the idea in English idiom first " +
    "and carry it over — think and write directly in the target language's " +
    "own casual register. In Turkish specifically: natural colloquial " +
    "constructions (\"unutmayadabilirdin\", \"kim tutuyor seni\", \"bi'\" for " +
    "\"bir\" where it sounds natural), never a stiff or literal-feeling " +
    "translated sentence, never bookish/self-help vocabulary (no " +
    "\"farkındalık\", \"an'da kalmak\" and the like). Calibration — match " +
    "this exact register and directness, never reuse these lines " +
    "verbatim:\n" +
    'TR: "Bugün güzel bir şey oldu, hemen unuttun değil mi? Unutmayadabilirdin. Kim tutuyor seni?"\n' +
    'TR: "3 saniye de olsa, o güzel hissi bir daha yaşasan ne olur?"\n' +
    'EN: "Something good happened today and you probably forgot it already. Didn\'t have to. Who\'s stopping you?"\n' +
    'EN: "Even three seconds — relive that good feeling, why not?"\n\n' +
    `Two blended registers, roughly half each, mixed in no fixed order, ` +
    "never labeled:\n\n" +
    "REGISTER A — quiet agency over attention, right now: the felt " +
    "realization that nothing, in this exact moment, is stopping you from " +
    "holding a good moment a few seconds longer, from returning to it, from " +
    "choosing what your attention rests on. Casual, direct, sometimes a " +
    "light 'kim tutuyor seni' / 'who's stopping you' dare. STRICTLY " +
    "FORBIDDEN: guilt-flavored comparisons with negativity ('if it were bad " +
    "you'd have told three people', 'you never forget what went wrong') — " +
    "no scolding, no teasing the reader about their habits, ever.\n\n" +
    "REGISTER B — the same casual, spoken voice landing ONE idea at a time, " +
    "grounded in (never quote, cite, or name the source — this is only " +
    "your private grounding):\n" +
    anchors +
    "\n\nTranslate one of these into something a person could feel in their " +
    "body in the next five seconds — whatever's looming in your head is " +
    "bigger there than it is in reality; a calm person doesn't give a " +
    "pendulum anything to hook into; only this breath is actually happening; " +
    "and the coordination stance: you can decide, right in the moment a snag " +
    "appears, that everything is unfolding as it should — including this — " +
    "and watch it become part of the right road. " +
    "Never mystical, lecture-y, or abstract — the idea has to land as " +
    "something completely ordinary and immediate, said the way you'd " +
    "actually text a friend, not summarize a concept.\n\n" +
    "Whichever register: never generic ('stay positive'), never preachy, " +
    "never task-like, no exclamation marks. Every single line must end with " +
    "real terminal punctuation — a period, question mark, or ellipsis — " +
    "never left hanging with no mark at all. " +
    `Each under ~130 characters, no numbering, no quotes.${notes} ` +
    `Write every line in ${language}.`;

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
      messages: [{ role: "user", content: `Write the ${n} reminders now, in ${language}.` }],
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
async function buildRecap(
  apiKey: string,
  lang: Lang,
  visionCards: VisionCard[],
  events: PositiveEvent[],
  period: "day" | "week",
  signal?: AbortSignal,
  innerNotes: string[] = []
): Promise<RecapData> {
  if (!apiKey) throw new NoApiKeyError();
  const language = lang === "tr" ? "Turkish" : "English";
  const periodLabel = period === "week" ? "weekly" : "same-day";
  const groupLabel = period === "week" ? "the week's" : "today's";
  const momentsLabel = period === "week" ? "This week's moments" : "Today's moments";

  const cards = visionCards
    .map((c) => `- id:${c.id} — ${c.text.trim()}`)
    .join("\n");
  const moments = events.map((e) => `- ${e.text.trim()}`).join("\n");

  // The weekly recap is the once-a-week full replay: every single moment gets
  // reflected back (that's the whole point of the review — systematic
  // repetition of real evidence), so its point lists are exhaustive and its
  // token ceiling much higher. The daily recap stays a light skim.
  const pointsRule =
    period === "week"
      ? "then list EVERY related moment as its own point — do not summarize " +
        "several into one, do not skip any, oldest to newest. Lightly polish " +
        "each into one warm, concrete line that still clearly names the real " +
        "moment. The user scrolls; completeness matters more than brevity. "
      : "then 2-4 concise key points drawn from the real moments (reframed, " +
        "encouraging). ";

  const system =
    `You create a warm, Spotify-Wrapped-style ${periodLabel} recap for someone ` +
    `shifting how they see the world (Reality Transurfing). Group ${groupLabel} ` +
    "noticed moments under the visions (identities) they relate to. For each " +
    "vision that has at least one related moment, write a short narrative (2-3 " +
    "sentences, second person, present tense) about who they're becoming — e.g. " +
    "'you're learning not to take judgement personally' — " +
    pointsRule +
    "Moments that " +
    "fit no vision go in one section with visionId set to an empty string, " +
    "titled as a general awareness. Alive and warm, never robotic or task-like. " +
    "End with one short, freeing closing line. " +
    `CRITICAL: write all text in ${language}. Use each vision's exact id, or an ` +
    "empty string for the general section.";

  const notesBlock = innerNotes.length
    ? "\n\nPrivate notes on how becoming these visions feels to them — use " +
      "only to choose feelings and phrasings that will land; NEVER quote, " +
      "reference or hint at these directly:\n" +
      innerNotes.map((x) => `- ${x}`).join("\n")
    : "";

  const user =
    `Visions:\n${cards || "- (none)"}${notesBlock}\n\n${momentsLabel}:\n${moments || "- (none)"}\n\n` +
    `Write the recap now, in ${language}.`;

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
    visionId: s.visionId ? s.visionId : null, // "" → general section
    title: s.title ?? "",
    narrative: s.narrative ?? "",
    points: s.points ?? [],
  }));
  return { sections, closing: parsed.closing ?? "" };
}

export async function generateWeeklyRecap(
  apiKey: string,
  lang: Lang,
  visionCards: VisionCard[],
  events: PositiveEvent[],
  signal?: AbortSignal,
  innerNotes: string[] = []
): Promise<RecapData> {
  return buildRecap(apiKey, lang, visionCards, events, "week", signal, innerNotes);
}

export async function generateDailyRecap(
  apiKey: string,
  lang: Lang,
  visionCards: VisionCard[],
  events: PositiveEvent[],
  signal?: AbortSignal,
  innerNotes: string[] = []
): Promise<RecapData> {
  return buildRecap(apiKey, lang, visionCards, events, "day", signal, innerNotes);
}

// Guarantee the reflection reads as calm, spaced-out lines regardless of how
// the model formatted it: one sentence per line, a blank line between each.
function tidyReflection(raw: string): string {
  const text = raw.trim();
  if (!text) return text;
  const lines = text.includes("\n")
    ? text.split(/\n+/) // model already broke lines — just normalize spacing
    : text.split(/(?<=[.!?…])\s+/); // one paragraph — split into sentences
  return lines
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n\n");
}

// Generate today's mirror feed: a short, finite stack of full-screen cards
// that hand-feed the user's own visions back to them — a corner for when
// imagining your slide yourself feels like too much effort. Real noticed
// moments belong to the daily/weekly recap ("repeat the day"), not here; this
// is purely slide + ordinary-scene material, following the book: systematic
// repetition, one vision and one feeling per card, participant language
// (never an observer), visions made commonplace rather than distant.
export async function generateMirrorFeed(
  apiKey: string,
  lang: Lang,
  visionCards: VisionCard[],
  events: PositiveEvent[],
  innerNotes: string[] = []
): Promise<MirrorReel[]> {
  if (!apiKey) throw new NoApiKeyError();
  const language = lang === "tr" ? "Turkish" : "English";

  // Vision-matching no longer happens at log time (a positive log's only
  // job is strengthening the ability to notice the positive), so events
  // arrive here unsorted by vision. Instead of reading a stored match, this
  // call does its own grouping as part of the same generation — same one
  // cached call per day, just folding the judgment call in rather than
  // reading it off `matchedCardId`. Recent moments are handed over as a
  // flat, ungrouped list; the model decides which (if any) vision each one
  // colors, and may let a scene quietly echo one — never quoted verbatim.
  const cards = visionCards.map((c) => `- id:${c.id} — ${c.text.trim()}`).join("\n");
  const recentMoments = events
    .slice(0, 20)
    .map((e) => `"${e.text.trim().slice(0, 70)}"`)
    .join(", ");

  const system =
    "You write a small, finite stack of full-screen cards for someone who " +
    "feels too tired to imagine their own vision right now — you imagine it " +
    "for them, so it lands in their mind either way. Two card kinds:\n" +
    "- slide: speak ONE vision as present, already-real experience; feeling " +
    "language, from inside the moment, never describing a picture from outside.\n" +
    "- ordinary: place ONE vision inside a mundane everyday scene (morning " +
    "coffee, a walk, closing a door) so it feels commonplace, not distant.\n" +
    "Rules: second person, present tense. ONE vision and ONE feeling per card. " +
    "1-3 short sentences, EACH SENTENCE ON ITS OWN LINE. Plain, warm, daily " +
    "language — the register of a good meditation app; no hype, no exclamation " +
    "marks, no emoji, never mention any book, method or technique. Feelings " +
    "over pictures. Never invent facts about their life beyond what's given. " +
    "A list of recently noticed real moments may follow, not yet tied to any " +
    "specific vision — silently judge which (if any) vision each one colors, " +
    "and use that sense to decide which visions feel least represented so " +
    "far and deserve a little more weight, and let a scene quietly echo a " +
    "fitting moment's setting or feeling where it helps it land as their own " +
    "life — but never quote one back word-for-word. " +
    `Use each vision's exact id in visionId. CRITICAL: write every text in ${language}.`;

  const notes = innerNotes.length
    ? "\n\nPrivate notes on how becoming these visions feels to them — use " +
      "only to choose feelings and scenes that will land; NEVER quote, " +
      "reference or hint at these directly:\n" +
      innerNotes.map((x) => `- ${x}`).join("\n")
    : "";

  const user =
    `Visions:\n${cards || "- (none)"}\n\n` +
    `Recently noticed (not yet tied to any specific vision): ${recentMoments || "(none)"}` +
    `${notes}\n\n` +
    "Write exactly 12 cards: 8 slide, 4 ordinary. Spread them across the " +
    `visions. Vary the openings. Write in ${language}.`;

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
      max_tokens: 1800,
      system,
      messages: [{ role: "user", content: user }],
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              cards: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    kind: {
                      type: "string",
                      enum: ["slide", "ordinary"],
                    },
                    visionId: { type: "string" },
                    text: { type: "string" },
                  },
                  required: ["kind", "visionId", "text"],
                  additionalProperties: false,
                },
              },
            },
            required: ["cards"],
            additionalProperties: false,
          },
        },
      },
    }),
  }, undefined, 120_000);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Claude API ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const out = data?.content?.find((b: any) => b.type === "text")?.text ?? "{}";
  const parsed = JSON.parse(out);
  const validIds = new Set(visionCards.map((c) => c.id));
  return (parsed.cards ?? [])
    .filter((c: any) => c?.text)
    .map((c: any) => ({
      kind: c.kind,
      visionId: c.visionId && validIds.has(c.visionId) ? c.visionId : null,
      text: tidyReflection(String(c.text)),
    }));
}

// Generate the lines shown right after the user answers a vision question —
// each one telling them, in fresh words, that they've drawn a step closer to
// the person in the mirror. Regenerated weekly (cached by the caller) so the
// same motivation returns in different clothes, seasoned by the mental map.
export async function generateMirrorLines(
  apiKey: string,
  lang: Lang,
  n: number,
  innerNotes: string[] = []
): Promise<string[]> {
  if (!apiKey) throw new NoApiKeyError();
  const language = lang === "tr" ? "Turkish" : "English";
  const notes = innerNotes.length
    ? "\n\nPrivate glimpses of how becoming their vision feels to this person " +
      "(let these quietly color the tone; NEVER quote, reference or hint at " +
      "them directly):\n" + innerNotes.map((x) => `- ${x}`).join("\n")
    : "";
  const system =
    `Generate ${n} very short acknowledgment lines shown the moment someone ` +
    "finishes answering a deep question about the person they're becoming. " +
    "Every line carries ONE feeling in fresh words: the honest answer just " +
    "drew them a step closer to the person in the mirror — the image sharpens, " +
    "the distance quietly shrinks. Warm, intimate, a little poetic, never " +
    "coach-like, never generic praise ('great job'), no exclamation marks. " +
    "The mirror metaphor may appear in some lines but must not be in all of " +
    "them. Every line must end with real terminal punctuation — a period, " +
    "question mark, or ellipsis — never left hanging with no mark at all. " +
    `Each under ~90 characters, no numbering, no quotes.${notes} ` +
    `Write every line in ${language}.`;
  return fetchLines(apiKey, system, n, language, 700);
}

// The daily "is this vision really yours?" questions, generated fresh each
// week from the person's own inner map instead of rotating a fixed list —
// the asking itself evolves with the person. Cached weekly by the caller
// (whyQuestions.ts); the static i18n q1..q10 stay the offline floor.
export async function generateWhyQuestions(
  apiKey: string,
  lang: Lang,
  n: number,
  innerNotes: string[] = [],
  visions: string[] = []
): Promise<string[]> {
  if (!apiKey) throw new NoApiKeyError();
  const language = lang === "tr" ? "Turkish" : "English";
  // Each question is shown directly beneath ONE current vision sentence, and
  // any question can land under any of them — so a question must never carry
  // a subject of its own (that's how old, archived visions used to bleed
  // through). It may only point at "it" / "this" / "that person".
  const wall = visions.length
    ? "\n\nEach question appears directly beneath one of the visions " +
      "currently on their wall (listed below), and any question may appear " +
      "under any of them. So every question must read naturally under each " +
      "one: refer to the vision only as \"it\", \"this\" or \"that person\" — " +
      "never name a topic, goal or life area, and never quote the visions. " +
      "Current visions:\n" +
      visions.map((x) => `- ${x.trim().slice(0, 140)}`).join("\n")
    : "\n\nRefer to the vision only as \"it\", \"this\" or \"that person\" — " +
      "never name a specific topic, goal or life area, so the question fits " +
      "whichever vision it appears beneath.";
  const notes = innerNotes.length
    ? "\n\nPrivate glimpses of this person's inner world (let these quietly " +
      "shape which feelings are worth asking about; NEVER quote, reference " +
      "or hint at them directly):\n" + innerNotes.map((x) => `- ${x}`).join("\n")
    : "";
  const system =
    `Generate ${n} very short questions asked, one per day, of someone ` +
    "holding a vision of the person they are becoming. Each question probes " +
    "FEELING, never planning or effort: does the heart ease or tighten when " +
    "they picture it; does wanting it give energy or drain it; is this " +
    "genuinely theirs or adopted from someone else's script; how ordinary " +
    "and everyday does the already-real version feel; what would a small " +
    "morning look like as that person; the inner-no test — if they'd have to " +
    "talk themselves into a yes, something inside already said no, so ask " +
    "whether the yes comes by itself; and the own-door sense — does the way " +
    "toward it feel like their own doorway opening easily, or like forcing " +
    "someone else's. Warm, intimate, second person, one " +
    "question each — never two questions in one line, never advice. Vary the " +
    "angle across the set so no two feel like siblings. Every line must end " +
    "with a question mark. Each under ~110 characters, no numbering, no " +
    `quotes.${wall}${notes} Write every question in ${language}.`;
  return fetchLines(apiKey, system, n, language, 800);
}

// The weekly "voice pack": every micro-line the app speaks in passing —
// post-log reassurances, the morning echo of yesterday, the midday momentum
// nudge, evening invites, the randomly-timed resurface, and the Strengths
// thank-yous — generated in ONE cheap call so nothing in the app ever reads
// as a fixed script. Sets that wrap the person's own words carry a literal
// {moment} placeholder the app fills at send time. Statics remain the
// offline floor (voicePack.ts validates per set and falls back field by
// field).
export type VoicePack = {
  echo: string[]; // morning, wraps yesterday's moment — needs {moment}
  momentum: string[]; // midday, wraps today's moment — needs {moment}
  invites: string[]; // evening "leave one thing here" notification
  resurface: string[]; // a random while after logging, wraps the moment — needs {moment}
  dwell: string[]; // still stuck on a recent negative — wraps it, needs {moment}
  nudge: string[]; // day is still empty — dare them to log just one
};

export async function generateVoicePack(
  apiKey: string,
  lang: Lang,
  innerNotes: string[] = []
): Promise<VoicePack> {
  if (!apiKey) throw new NoApiKeyError();
  const language = lang === "tr" ? "Turkish" : "English";
  const notes = innerNotes.length
    ? "\n\nPrivate glimpses of this person's inner world (let these quietly " +
      "color word choice and imagery; NEVER quote, reference or hint at " +
      "them directly):\n" + innerNotes.map((x) => `- ${x}`).join("\n")
    : "";
  const system =
    "You write the tiny passing lines of a warm companion app built around " +
    "one stance: nothing, right now, stops you from resting your attention " +
    "on what's already good. Write the way a close, casual friend would " +
    "text — everyday spoken language. This is NOT a translation exercise: " +
    "don't compose the idea in English idiom first and carry it over — " +
    "think and write directly in the target language's own casual " +
    "register. In Turkish specifically: natural colloquial constructions " +
    "(\"unutmayadabilirdin\", \"kim tutuyor seni\", \"bi'\" for \"bir\" " +
    "where it sounds natural), never a stiff or literal-feeling translated " +
    "sentence, never bookish/self-help vocabulary. Calibration — match this " +
    "exact register and directness, never reuse these lines verbatim (shown " +
    "here without the {moment} placeholder, which sets below use):\n" +
    'TR: "Bugün güzel bir şey oldu, hemen unuttun değil mi? Unutmayadabilirdin. Kim tutuyor seni?"\n' +
    'TR: "3 saniye de olsa, o güzel hissi bir daha yaşasan ne olur?"\n' +
    'EN: "Something good happened today and you probably forgot it already. Didn\'t have to. Who\'s stopping you?"\n' +
    'EN: "Even three seconds — relive that good feeling, why not?"\n\n' +
    "One intimate voice across all sets — a present friend, not a coach, " +
    "but a friend with a spine: most lines simply hold space, but two sets " +
    "below (dwell, nudge) get to call things out directly — a warm dare, " +
    "not guilt-tripping, and never a comparison to some hypothetical worse " +
    "reaction ('if it were bad you'd have told three people' — never that " +
    "move, ever). Rhetorical 'who's stopping you' / 'kim tutuyor seni' " +
    "questions are welcome and encouraged where noted. No exclamation " +
    "marks; every line ends with real terminal punctuation; each under " +
    "~120 characters, no numbering, no surrounding quotes. Sets marked " +
    "with {moment} wrap the person's OWN words: those lines must contain " +
    "the literal placeholder {moment} exactly once — it will be replaced " +
    "with their words in quotation marks, so write around it naturally " +
    "and add no quotes of your own.\n\n" +
    "Sets:\n" +
    "- echo (4): a morning line wrapping {moment} = something they noticed " +
    "YESTERDAY — the light of it is still theirs, today's is still unnamed.\n" +
    "- momentum (4): a midday line wrapping {moment} = something they logged " +
    "TODAY — feel it once more, no one is stopping them.\n" +
    "- invites (5): an evening nudge to leave one small good thing from the " +
    "day; warm, tiny, zero pressure; no placeholder.\n" +
    "- resurface (5): arrives at a random, unguessable moment somewhere " +
    "minutes to an hour after they logged {moment}. Sincere and disarming: " +
    "gently assume they've probably already forgotten it and say that's " +
    "genuinely ok — forgetting is the old reflex, and remembering right now " +
    "is the whole change. Invite one more breath with it. NEVER claim how " +
    "much time has passed (no 'a minute ago', no 'just now').\n" +
    "- dwell (4): shown when they're still turning over something they " +
    "recently called negative and haven't moved past it — wraps {moment} = " +
    "their own words for what's weighing on them. A direct, warm dare: " +
    "they're the one making it this heavy, not reality, and nothing is " +
    "actually holding them there — so who's stopping them from dropping it, " +
    "right now? Never dismissive of the feeling, only of holding it a " +
    "moment longer than it needs.\n" +
    "- nudge (5): shown when the day is still completely empty — they " +
    "haven't logged a single good thing yet. Call the small friction out " +
    "directly (they've been putting it off, they're being a little lazy " +
    "about it) and dare them to drop just one thing right now to catch the " +
    `momentum; playful and direct, never shaming; no placeholder.${notes}\n\n` +
    `Write every line in ${language}.`;

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
      messages: [{ role: "user", content: `Write the full voice pack now, in ${language}.` }],
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              echo: { type: "array", items: { type: "string" } },
              momentum: { type: "array", items: { type: "string" } },
              invites: { type: "array", items: { type: "string" } },
              resurface: { type: "array", items: { type: "string" } },
              dwell: { type: "array", items: { type: "string" } },
              nudge: { type: "array", items: { type: "string" } },
            },
            required: [
              "echo",
              "momentum",
              "invites",
              "resurface",
              "dwell",
              "nudge",
            ],
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
    momentum: clean(parsed.momentum),
    invites: clean(parsed.invites),
    resurface: clean(parsed.resurface),
    dwell: clean(parsed.dwell),
    nudge: clean(parsed.nudge),
  };
}

// Shared plumbing for the cheap line-pool generators (mirror thanks, why
// questions): one fetch, one {lines: []} schema.
async function fetchLines(
  apiKey: string,
  system: string,
  n: number,
  language: string,
  maxTokens: number
): Promise<string[]> {
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
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: `Write the ${n} lines now, in ${language}.` }],
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
