import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { dateKey, dateIndex, addDays } from "./dates";
import { addEvent, getEvents, PositiveEvent } from "./events";
import { generateHeartfeltReminders } from "./claude";
import { normalizeLines } from "./text";
import { getVoicePack, fillMoment } from "./voicePack";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const APP_TITLE = "Slide";
const LOG_CATEGORY = "log_positive";
const LOG_ACTION = "INPUT";

// Warm, CASUAL, spoken-language reminders used when there's no API key (or
// generation fails) — the way you'd actually text a friend, not a
// translated-from-English or self-help-book register. Two angles, mixed in
// no fixed order: (a) quiet agency — nothing, right now, is stopping you
// from holding a good thing a few seconds longer, often with a light "kim
// tutuyor seni?" dare; (b) a plain, concrete distillation of one Reality
// Transurfing idea at a time — importance inflating a problem past its real
// size, a calm person giving a pendulum nothing to hook into, only this
// breath being real — never naming the book. NO cold comparisons ("if it
// were bad you'd have told three people") — the user explicitly retired
// that register: it reads as scolding, not warmth. This whole pool got a
// full rewrite 2026-07-16 after an AI-generated line came out stiff and
// half-translated ("İyi olan şeyi biraz abartmak özür dile...") — see the
// calibration lines baked into generateHeartfeltReminders's prompt too.
const FALLBACK: string[] = [
    "Something good happened today and you probably forgot it already. Didn't have to. Who's stopping you?",
    "Even three seconds — relive that good feeling from today, why not?",
    "You don't need anyone's permission to enjoy something good. Right now included.",
    "Go ahead and hype up something good that happened today — who's it hurting?",
    "Wait — something's going right this exact second and you're missing it. Find it.",
    "The world threw you a little bone today. If you missed it, look again.",
    "That thing you called 'not bad' — it was actually great. Don't shrink it.",
    "That easy breath you took today — that mattered. Don't forget it.",
    "Your attention's yours, point it wherever you want. No one can stop you.",
    "Feeling a good moment again is free, and it never runs out.",
    "Nothing to lose here — play today like a game.",
    "Take a breath. It's not as big as your head's making it.",
    "The harder you push, the further it runs; let go and it comes closer. Try dropping one thing today.",
    "Nothing sticks to someone who stays calm. Skip today's rush.",
    "Lower the stakes and the weight drops on its own.",
    "Nothing outside this breath is real right now. Just stay in it a sec.",
    "Whatever's bugging you isn't as heavy as your head's making it.",
    "Nothing's holding you here. Look at something else if you want.",
    "You don't need a special moment to think of something good. This one works fine.",
    "Even the thing going wrong might be exactly on track. Call it that and watch it straighten out.",
    "Today's hiccup might just be part of the right path. Your call.",
];

// Morning echo of YESTERDAY's last noticed moment — the mirror remembering,
// not the app counting. This replaced the streak/count fragments ("day 3 in
// a row"): scorekeeping inflates importance and reads as a chore app, while
// echoing the person's own words back reads as being seen.
const ECHO_LINES: ((short: string) => string)[] = [
    (s) => `You said “${s}” yesterday, you've probably already forgotten it. Didn't have to — who's stopping you from going back?`,
    (s) => `“${s}” — that glow from yesterday is still yours. Even three seconds, feel it again.`,
    (s) => `You noticed “${s}” yesterday. Look at today with the same eyes, see what shows up.`,
    (s) => `“${s}” — that was yesterday. Today's is still unnamed, be the first to catch it.`,
    (s) => `You said “${s}” yesterday — forgot it already, huh? Didn't have to.`,
];

function echoLine(sample: string, dateStr: string): string {
  const short = sample.length > 80 ? sample.slice(0, 78) + "…" : sample;
  const pool = ECHO_LINES;
  return pool[dateIndex(dateStr, pool.length, "echo")](short);
}

// Pick a moment-wrapping line: the weekly voice pack when it has a valid
// set, the static template pool otherwise. Same deterministic per-date pick
// either way.
function shorten(sample: string): string {
  return sample.length > 80 ? sample.slice(0, 78) + "…" : sample;
}

function momentLine(
  packLines: string[],
  staticLine: (sample: string, dateStr: string) => string,
  sample: string,
  dateStr: string,
  salt: string
): string {
  if (packLines.length) {
    return fillMoment(packLines[dateIndex(dateStr, packLines.length, salt)], shorten(sample));
  }
  return staticLine(sample, dateStr);
}

// v3: the voice went casual/spoken instead of translated-English-idiom
// (2026-07-16, after an AI-generated line came out stiff and half-broken)
// — bumping the key orphans any cached v1/v2 pool so old lines can't keep
// serving for up to a week after the update.
const REMINDER_CACHE = "heartfeltReminders:v3";
const REMINDER_TTL = 7 * 24 * 60 * 60 * 1000; // refresh weekly
const DAYS_AHEAD = 7;
const HEARTFELT_HOUR = 10; // a gentle morning nudge
const MIDDAY_HOUR = 15; // a second touch — personalized to today when possible
const LOG_HOUR = 20; // an evening invite to notice something good

// Several evening invites instead of one fixed line, picked per date the
// same deterministic way — the reflex-breaking voice, not a repeating chore.
const LOG_INVITES: string[] = [
    "Something went right today, I know it. However small, leave it here.",
    "Who's stopping you from thinking about today's good moment one more time? Which one was it?",
    "Somewhere today you breathed easy for a second. What was it?",
    "Shake today out and something good you missed would fall out. Find it.",
    "Got a minute? One thing from today, however tiny.",
    "Day's almost over, still haven't written it down. Thirty seconds — who's stopping you?",
];

const TEXT = { logButton: "Write", logPlaceholder: "A small positive sign…", logSubmit: "Add" };

export async function requestPermissions(): Promise<boolean> {
  if (!Device.isDevice) return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (existing !== "granted") {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  return status === "granted";
}

async function setupCategory(): Promise<void> {
  const text = TEXT;
  await Notifications.setNotificationCategoryAsync(LOG_CATEGORY, [
    {
      identifier: LOG_ACTION,
      buttonTitle: text.logButton,
      textInput: { submitButtonTitle: text.logSubmit, placeholder: text.logPlaceholder },
      options: { opensAppToForeground: false },
    },
  ]);
}

// Get the pool of heartfelt lines: cached weekly, AI-generated when a key is
// present, otherwise the curated fallback.
async function getHeartfeltLines(apiKey: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(REMINDER_CACHE);
    if (raw) {
      const c = JSON.parse(raw);
      if (Date.now() - c.createdAt < REMINDER_TTL && c.lines?.length >= DAYS_AHEAD) {
        return c.lines;
      }
    }
  } catch {}

  let lines = FALLBACK;
  if (apiKey) {
    try {
      const gen = await generateHeartfeltReminders(apiKey, 14);
      if (gen.length >= DAYS_AHEAD) lines = normalizeLines(gen);
    } catch {
      // keep fallback
    }
  }
  AsyncStorage.setItem(
    REMINDER_CACHE,
    JSON.stringify({ lines, createdAt: Date.now() })
  ).catch(() => {});
  return lines;
}

// Schedule a rolling week of warm reminders — three fixed touches a day and
// nothing else: a morning mirror, a midday reminder to look at what's
// already good, and an evening invite to leave one thing here (reply-able).
// Today's morning stays personal without counting anything: it echoes
// YESTERDAY's last noticed moment in the person's own words — the mirror
// remembering, zero extra AI cost. Every other slot takes a line picked by
// the actual calendar date (NOT by loop position), so re-running this on
// every app open can't keep resetting "today" back to the same pool entry.
// Re-runs on app open to refresh the window.
//
// What deliberately ISN'T here: anything that fires because of what the
// person did or didn't do. A log used to buy a second ping later that day,
// and an empty afternoon used to buy a dare to fill it. Both turned the
// mirror into something that chases — the day is three quiet touches now,
// the same three whether the person logs ten things or nothing at all.
//
// App.tsx calls this both on mount and on every foreground transition, so
// two calls can land close together (e.g. a quick background/foreground
// flicker). Without a guard, both would call cancelAllScheduledNotificationsAsync
// and then independently schedule the same 21 notifications, before either
// one's additions existed for the other to cancel — producing exact
// duplicates. `inFlight` collapses overlapping calls into the one already
// running instead of racing a second cancel+reschedule cycle against it.
let inFlight: Promise<void> | null = null;
export function scheduleDailyReminders(apiKey: string): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = scheduleDailyRemindersNow(apiKey).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

// Same-day short-circuit: rescheduling is only worth doing when its INPUTS
// changed — the date rolled over, the language changed, or the personalized
// samples (today's / yesterday's last logged moment) differ from what's
// already scheduled. Without this, every foreground paid the full
// cancel-all + 21 sequential native scheduling calls; a heavy day of
// check-ins re-did identical work twenty times over. Module-level (not
// persisted): a fresh process reschedules once, which is exactly right.
let lastScheduleKey: string | null = null;

async function scheduleDailyRemindersNow(apiKey: string): Promise<void> {
  const now = new Date();

  let yesterdaysSample: string | null = null;
  try {
    const events = await getEvents(); // newest first
    const yesterday = addDays(dateKey(), -1);
    const yest = events.filter((e) => e.date === yesterday);
    if (yest.length > 0) yesterdaysSample = yest[0].text; // last noticed yesterday
  } catch {}

  const scheduleKey = [dateKey(), yesterdaysSample ?? ""].join(" ");
  if (scheduleKey === lastScheduleKey) return;

  // Cancel the whole mind window and rebuild it. This must leave OTHER rooms
  // alone: supplements schedule their own reminders, and a blanket cancel
  // here would quietly delete them on every foreground. Untagged
  // notifications are this module's own from before rooms existed, so those
  // still go — which is also how a resurface left over from a previous
  // version finally clears itself out.
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => {
        const data = (n.content?.data ?? {}) as { room?: string };
        return data.room === undefined || data.room === "mind";
      })
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
  );
  const lines = await getHeartfeltLines(apiKey);
  const pack = await getVoicePack(apiKey);
  const invites = pack.invites.length ? pack.invites : LOG_INVITES;

  for (let d = 0; d < DAYS_AHEAD; d++) {
    const morning = new Date(now);
    morning.setDate(now.getDate() + d);
    morning.setHours(HEARTFELT_HOUR, 0, 0, 0);
    if (morning > now) {
      const key = dateKey(morning);
      // Only today's morning can echo yesterday — a future morning would be
      // echoing the wrong "yesterday", so those stay on the general pool.
      const body =
        d === 0 && yesterdaysSample
          ? momentLine(pack.echo, echoLine, yesterdaysSample, key, "echo")
          : lines[dateIndex(key, lines.length, "am")];
      await Notifications.scheduleNotificationAsync({
        content: { title: APP_TITLE, body, data: { room: "mind" } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: morning },
      });
    }

    const midday = new Date(now);
    midday.setDate(now.getDate() + d);
    midday.setHours(MIDDAY_HOUR, 0, 0, 0);
    if (midday > now) {
      const key = dateKey(midday);
      // Deliberately impersonal: the same line whether the day is full or
      // empty. It points at what's already good, it doesn't check up on
      // anyone.
      const body = lines[dateIndex(key, lines.length, "pm")];
      await Notifications.scheduleNotificationAsync({
        content: { title: APP_TITLE, body, data: { room: "mind" } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: midday },
      });
    }

    const evening = new Date(now);
    evening.setDate(now.getDate() + d);
    evening.setHours(LOG_HOUR, 0, 0, 0);
    if (evening > now) {
      const key = dateKey(evening);
      const body = invites[dateIndex(key, invites.length, "eve")];
      await Notifications.scheduleNotificationAsync({
        content: {
          title: APP_TITLE,
          body,
          categoryIdentifier: LOG_CATEGORY,
          data: { room: "mind" },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: evening },
      });
    }
  }

  // Only mark done after the full window scheduled — a throw above leaves
  // the key unset so the next foreground retries.
  lastScheduleKey = scheduleKey;
}

export async function ensureNotifications(apiKey: string): Promise<boolean> {
  const granted = await requestPermissions();
  if (granted) {
    await setupCategory();
    await scheduleDailyReminders(apiKey);
  }
  return granted;
}

// Shared landing for any text captured outside the normal LogEventSheet flow
// (a notification reply, a Siri capture drained on foreground) — it just
// lands the event. Capturing something is the whole transaction; it doesn't
// buy a follow-up ping.
export async function logCapturedText(text: string): Promise<void> {
  const value = text.trim();
  if (!value) return;

  const event: PositiveEvent = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    text: value,
    date: dateKey(),
    createdAt: Date.now(),
  };
  await addEvent(event);
}

// Called when the user replies to an evening "notice something good" prompt.
export async function handleNotificationResponse(
  response: Notifications.NotificationResponse
): Promise<void> {
  if (response.actionIdentifier !== LOG_ACTION) return;
  const userText = (response as any).userText?.trim();
  if (!userText) return;
  await logCapturedText(userText);
}
