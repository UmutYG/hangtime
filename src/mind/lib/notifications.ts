import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Lang } from "./i18n";
import { dateKey, dateIndex, addDays } from "./dates";
import { addEvent, updateEvent, getEvents, PositiveEvent } from "./events";
import { loadSettings } from "./settings";
import { generateHeartfeltReminders, matchEventToVision } from "./claude";
import { buildInnerNotes } from "./innerMap";
import { getReframes } from "./reframes";
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
const FALLBACK: Record<Lang, string[]> = {
  tr: [
    "Bugün güzel bir şey oldu, hemen unuttun değil mi? Unutmayadabilirdin. Kim tutuyor seni?",
    "3 saniye de olsa, bugünkü güzel hissi bir daha yaşasan ne olur?",
    "İyi bir şeyin tadını çıkarmak için kimseden izin almana gerek yok. Şu an dahil.",
    "Bugün olan güzel bir şeyi abartsan kime ne zararı olur? Abart gitsin.",
    "Dur bi' — şu an bir şey yolunda gidiyor ve sen fark etmiyorsun. Bul onu.",
    "Dünya bugün sana küçük bir jest yaptı. Görmediysen tekrar bak.",
    "'Fena değildi' dediğin o an aslında harikaydı. Küçültme.",
    "Rahat bir nefes aldığın o an vardı ya — önemliydi. Unutma.",
    "Dikkatin senin, istediğin yere çevirebilirsin. Kimse karışamaz.",
    "İyi bir anı bir kez daha hissetmek bedava. Üstelik süresi de dolmuyor.",
    "Kaybedecek bir şeyin yok, bugünü bi' oyun gibi oyna.",
    "Bir nefes al. Kafanda büyüttüğün kadar büyük değil aslında.",
    "Zorladıkça kaçıyor, bıraktıkça geliyor — bugün bir şeyi bırakmayı dene.",
    "Sakin kalana hiçbir şey tutunamaz. Bugün telaşa katılma.",
    "Önemi düşür, ağırlık kendiliğinden hafifler.",
    "Şu anki nefesin dışında hiçbir şey gerçek değil şu an. Onda kal biraz.",
    "Kafanı kurcalayan şey, sandığın kadar ağır değil aslında.",
    "Hiçbir şey seni burada tutmuyor. İstersen başka bir şeye bak şimdi.",
    "Güzel bir şey düşünmek için özel bir an gerekmiyor. Bu an da olur.",
    "Ters giden bir şey bile yolun parçası olabilir. Öyle say, düzelsin.",
    "Bugünkü aksilik belki de doğru yolun bir parçası. Karar senin.",
  ],
  en: [
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
  ],
};

// A same-day nudge tied to something the user already noticed — this is what
// makes the app feel like it's living alongside them, not just pinging on a
// timer. Several phrasings, picked deterministically per date so today always
// shows the same one but tomorrow brings a different one.
const MOMENTUM_LINES: Record<Lang, ((short: string) => string)[]> = {
  tr: [
    (s) => `“${s}” oldu bugün, sen çoktan unuttun bile. Unutmayadabilirdin — kim tutuyor seni tadını çıkarmaktan?`,
    (s) => `“${s}” — 3 saniye de olsa bir daha yaşasan ne olur?`,
    (s) => `Bugün “${s}” demiştin. Küçük görünüyor ama değildi — abartsan kimseye zararı yok.`,
    (s) => `“${s}” — bugünün anıydı bu. İstersen şimdi bir daha yaşa, bedava.`,
    (s) => `“${s}” oldu ve sen çoktan geçtin bile. Geri dön — kim tutuyor seni?`,
  ],
  en: [
    (s) => `“${s}” happened today and you've probably already moved on. Didn't have to — who's stopping you from milking it a little?`,
    (s) => `“${s}” — even three seconds, live it again?`,
    (s) => `You said “${s}” today. Looked small, wasn't — go ahead and hype it up, no harm done.`,
    (s) => `“${s}” — that was your moment today. Live it once more right now if you want. Free.`,
    (s) => `“${s}” happened and you're already past it. Go back — who's stopping you?`,
  ],
};

function momentumLine(lang: Lang, sample: string, dateStr: string): string {
  const short = sample.length > 80 ? sample.slice(0, 78) + "…" : sample;
  const pool = MOMENTUM_LINES[lang];
  return pool[dateIndex(dateStr, pool.length, "momentum")](short);
}

// Morning echo of YESTERDAY's last noticed moment — the mirror remembering,
// not the app counting. This replaced the streak/count fragments ("day 3 in
// a row"): scorekeeping inflates importance and reads as a chore app, while
// echoing the person's own words back reads as being seen.
const ECHO_LINES: Record<Lang, ((short: string) => string)[]> = {
  tr: [
    (s) => `Dün “${s}” demiştin, bugün unutmuş bile olabilirsin. Unutmayadabilirdin — geri dön, kim tutuyor seni?`,
    (s) => `“${s}” — dünkü o ışık hâlâ senin. 3 saniye de olsa bir daha hisset.`,
    (s) => `Dün “${s}” fark ettin. Bugüne de aynı gözle bak, bakalım ne çıkacak.`,
    (s) => `“${s}” — dün buydu senin. Bugünkü daha isimsiz, ilk sen gör.`,
    (s) => `Dün “${s}” demiştin ya — unuttun mu şimdiden? Unutmayadabilirdin.`,
  ],
  en: [
    (s) => `You said “${s}” yesterday, you've probably already forgotten it. Didn't have to — who's stopping you from going back?`,
    (s) => `“${s}” — that glow from yesterday is still yours. Even three seconds, feel it again.`,
    (s) => `You noticed “${s}” yesterday. Look at today with the same eyes, see what shows up.`,
    (s) => `“${s}” — that was yesterday. Today's is still unnamed, be the first to catch it.`,
    (s) => `You said “${s}” yesterday — forgot it already, huh? Didn't have to.`,
  ],
};

function echoLine(lang: Lang, sample: string, dateStr: string): string {
  const short = sample.length > 80 ? sample.slice(0, 78) + "…" : sample;
  const pool = ECHO_LINES[lang];
  return pool[dateIndex(dateStr, pool.length, "echo")](short);
}

// Pick a moment-wrapping line: the weekly voice pack when it has a valid
// set, the static template pool otherwise. Same deterministic per-date pick
// either way.
function shorten(sample: string): string {
  return sample.length > 80 ? sample.slice(0, 78) + "…" : sample;
}

// Fires instead of the momentum line when the freshest thing the person did
// wasn't logging a positive — it was the reframe ritual, and it's recent
// enough that they're likely still turning it over. A direct, warm callout
// using their own words for what's weighing on them, not a comparison to
// some other reaction — that register stays retired.
const DWELL_LINES: Record<Lang, ((short: string) => string)[]> = {
  tr: [
    (s) => `“${s}”'i kaç kere daha düşüneceksin? Bırak artık, kim tutuyor seni?`,
    (s) => `Hâlâ “${s}” mi kafanda dönüyor? Bırakabilirsin şu an — kim tutuyor seni?`,
    (s) => `“${s}” demiştin. Onu bu kadar büyüten sensin, gerçeklik değil. Küçült biraz.`,
    (s) => `“${s}”'i tekrar tekrar düşünmek onu büyütmekten başka bi' işe yaramıyor. Bırak gitsin.`,
  ],
  en: [
    (s) => `How many more times are you gonna think about “${s}”? Let it go — who's stopping you?`,
    (s) => `Still stuck on “${s}”? You can drop it right now — who's stopping you?`,
    (s) => `You said “${s}”. You're the one making it this big, not reality. Shrink it a bit.`,
    (s) => `Replaying “${s}” over and over isn't doing anything but making it bigger. Let it go.`,
  ],
};

function dwellLine(lang: Lang, sample: string, dateStr: string): string {
  const short = shorten(sample);
  const pool = DWELL_LINES[lang];
  return pool[dateIndex(dateStr, pool.length, "dwell")](short);
}

// Fires instead of the momentum line when the day is still completely
// empty — a direct dare to log just one thing, no placeholder needed.
const NUDGE_LINES: Record<Lang, string[]> = {
  tr: [
    "Bugün hâlâ bir şey yazmadın. Üşeniyorsun, tamam ama bir tane at gitsin.",
    "Tek bir güzel şey. Sadece bir tane. Kim tutuyor seni?",
    "Bugün hâlâ boş. Bir şey oldu mutlaka — küçük de olsa yaz.",
    "Bir tane atmak otuz saniyeni alır, gerisini momentum hallediyor.",
    "Bugün güzel bir şey oldu ama sen yazmaya üşendin. Şimdi bir tane, olur mu?",
  ],
  en: [
    "Still haven't written anything today. You're being lazy, I get it — just drop one.",
    "One good thing. Just one. Who's stopping you?",
    "Still empty today. Something happened, I'm sure — write it, however small.",
    "Writing one takes thirty seconds, momentum does the rest.",
    "Something good happened today and you were too lazy to write it down. One, right now?",
  ],
};

// Pick a no-placeholder line: the weekly voice pack set when valid, the
// static pool otherwise. Same deterministic per-date pick as momentLine.
function pickLine(packPool: string[], staticPool: string[], dateStr: string, salt: string): string {
  const pool = packPool.length ? packPool : staticPool;
  return pool[dateIndex(dateStr, pool.length, salt)];
}

function momentLine(
  packLines: string[],
  staticLine: (lang: Lang, sample: string, dateStr: string) => string,
  lang: Lang,
  sample: string,
  dateStr: string,
  salt: string
): string {
  if (packLines.length) {
    return fillMoment(packLines[dateIndex(dateStr, packLines.length, salt)], shorten(sample));
  }
  return staticLine(lang, sample, dateStr);
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
const LOG_INVITES: Record<Lang, string[]> = {
  tr: [
    "Bugün bir şey iyi gitti, biliyorum. Ufacık da olsa buraya bırak.",
    "Günün güzel bir anını bir daha düşünsen kim karışır? Hangisiydi?",
    "Günün bir yerinde rahat bir nefes aldın. Neydi o?",
    "Bugünü bir sallasan, gözden kaçırdığın bir güzellik düşerdi. Bul onu.",
    "Bir dakikan var mı? Bugünden bir tane, ufacık da olsa.",
    "Gün bitiyor, sen hâlâ yazmadın. Otuz saniyeni al, kim tutuyor seni?",
  ],
  en: [
    "Something went right today, I know it. However small, leave it here.",
    "Who's stopping you from thinking about today's good moment one more time? Which one was it?",
    "Somewhere today you breathed easy for a second. What was it?",
    "Shake today out and something good you missed would fall out. Find it.",
    "Got a minute? One thing from today, however tiny.",
    "Day's almost over, still haven't written it down. Thirty seconds — who's stopping you?",
  ],
};

const TEXT: Record<Lang, { logButton: string; logPlaceholder: string; logSubmit: string }> = {
  tr: {
    logButton: "Yaz",
    logPlaceholder: "Küçük bir olumlu işaret…",
    logSubmit: "Ekle",
  },
  en: {
    logButton: "Write",
    logPlaceholder: "A small positive sign…",
    logSubmit: "Add",
  },
};

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

async function setupCategory(lang: Lang): Promise<void> {
  const text = TEXT[lang];
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
async function getHeartfeltLines(lang: Lang, apiKey: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(REMINDER_CACHE);
    if (raw) {
      const c = JSON.parse(raw);
      if (c.lang === lang && Date.now() - c.createdAt < REMINDER_TTL && c.lines?.length >= DAYS_AHEAD) {
        return c.lines;
      }
    }
  } catch {}

  let lines = FALLBACK[lang];
  if (apiKey) {
    try {
      const notes = await buildInnerNotes().catch(() => []);
      const gen = await generateHeartfeltReminders(apiKey, lang, 14, notes);
      if (gen.length >= DAYS_AHEAD) lines = normalizeLines(gen);
    } catch {
      // keep fallback
    }
  }
  AsyncStorage.setItem(
    REMINDER_CACHE,
    JSON.stringify({ lang, lines, createdAt: Date.now() })
  ).catch(() => {});
  return lines;
}

// Schedule a rolling week of warm reminders: a morning nudge, a midday touch,
// and an evening "notice something good" invite (reply-able). Today's lines
// stay personal without counting anything: the morning echoes YESTERDAY's
// last noticed moment in the person's own words, the midday quotes what they
// already logged TODAY — the mirror remembering, zero extra AI cost. The
// rest fall back to a line picked by the actual calendar date (NOT by loop
// position), so re-running this on every app open can't keep resetting
// "today" back to the same pool entry. Re-runs on app open to refresh the
// window and re-personalize today.
//
// App.tsx calls this both on mount and on every foreground transition, so
// two calls can land close together (e.g. a quick background/foreground
// flicker). Without a guard, both would call cancelAllScheduledNotificationsAsync
// and then independently schedule the same 21 notifications, before either
// one's additions existed for the other to cancel — producing exact
// duplicates. `inFlight` collapses overlapping calls into the one already
// running instead of racing a second cancel+reschedule cycle against it.
let inFlight: Promise<void> | null = null;
export function scheduleDailyReminders(lang: Lang, apiKey: string): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = scheduleDailyRemindersNow(lang, apiKey).finally(() => {
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

async function scheduleDailyRemindersNow(lang: Lang, apiKey: string): Promise<void> {
  const now = new Date();

  let todaysSample: string | null = null;
  let yesterdaysSample: string | null = null;
  let mostRecentEventAt = 0;
  try {
    const events = await getEvents(); // newest first
    const today = dateKey();
    const todays = events.filter((e) => e.date === today);
    if (todays.length > 0) todaysSample = todays[0].text; // most recent of today
    const yesterday = addDays(today, -1);
    const yest = events.filter((e) => e.date === yesterday);
    if (yest.length > 0) yesterdaysSample = yest[0].text; // last noticed yesterday
    if (events.length > 0) mostRecentEventAt = events[0].createdAt;
  } catch {}

  // The reframe ritual is the most honest "still stuck on this" signal the
  // app gets. If it's the freshest thing the person did — fresher than any
  // logged positive — and it's recent enough to still be live, the midday
  // slot calls it out directly instead of the usual momentum line. Capped
  // at 3 days so the app doesn't keep nagging about something they've since
  // just moved on from without telling it.
  let dwellSample: string | null = null;
  try {
    const [recent] = await getReframes(1);
    if (
      recent &&
      recent.createdAt > mostRecentEventAt &&
      Date.now() - recent.createdAt < 3 * 24 * 60 * 60 * 1000
    ) {
      dwellSample = recent.negative;
    }
  } catch {}

  const scheduleKey = [
    dateKey(),
    lang,
    todaysSample ?? "",
    yesterdaysSample ?? "",
    dwellSample ?? "",
  ].join(" ");
  if (scheduleKey === lastScheduleKey) return;

  // Cancel only the daily window — a pending resurface must survive this.
  // With its old fixed 75-second delay a resurface practically never
  // overlapped a reschedule; now that it can sit up to ~45 minutes out, a
  // quick background/foreground would silently eat it.
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => (n.content?.data as any)?.kind !== "resurface")
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
  );
  const lines = await getHeartfeltLines(lang, apiKey);
  const pack = await getVoicePack(lang, apiKey);
  const invites = pack.invites.length ? pack.invites : LOG_INVITES[lang];

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
          ? momentLine(pack.echo, echoLine, lang, yesterdaysSample, key, "echo")
          : lines[dateIndex(key, lines.length, "am")];
      await Notifications.scheduleNotificationAsync({
        content: { title: APP_TITLE, body },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: morning },
      });
    }

    const midday = new Date(now);
    midday.setDate(now.getDate() + d);
    midday.setHours(MIDDAY_HOUR, 0, 0, 0);
    if (midday > now) {
      const key = dateKey(midday);
      // Today's midday check-in reads the actual day: still stuck on a
      // recent negative wins (most honest signal), a logged positive gets
      // echoed back, an empty day gets a direct dare instead of silence.
      let body: string;
      if (d === 0 && dwellSample) {
        body = momentLine(pack.dwell, dwellLine, lang, dwellSample, key, "dwell");
      } else if (d === 0 && todaysSample) {
        body = momentLine(pack.momentum, momentumLine, lang, todaysSample, key, "momentum");
      } else if (d === 0) {
        body = pickLine(pack.nudge, NUDGE_LINES[lang], key, "nudge");
      } else {
        body = lines[dateIndex(key, lines.length, "pm")];
      }
      await Notifications.scheduleNotificationAsync({
        content: { title: APP_TITLE, body },
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
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: evening },
      });
    }
  }

  // Only mark done after the full window scheduled — a throw above leaves
  // the key unset so the next foreground retries.
  lastScheduleKey = scheduleKey;
}

export async function ensureNotifications(lang: Lang, apiKey: string): Promise<boolean> {
  const granted = await requestPermissions();
  if (granted) {
    await setupCategory(lang);
    await scheduleDailyReminders(lang, apiKey);
  }
  return granted;
}

// The resurface voice went sincere (2026-07-20): the old fixed 75-second
// timing had trained the brain to expect — and tune out — the ping, and the
// old lines assumed "a minute ago", which the random timing below makes
// untrue. These openly assume the moment has probably been forgotten and say
// that's ok — forgetting is the old reflex, noticing again is the change.
// None of them claim how much time has passed.
const RESURFACE_LINES: Record<Lang, ((short: string) => string)[]> = {
  tr: [
    (s) => `“${s}” — büyük ihtimalle çoktan unuttun, biliyorum. Sorun değil; unutmak eski alışkanlık. Şimdi hatırladın ya, mesele o.`,
    (s) => `“${s}” vardı ya? Bugün oldu bu. Hiçbir şey değilmiş gibi geçip gitti — dön, birkaç saniye daha tut.`,
    (s) => `Küçük bir kontrol: “${s}”. Hâlâ aklında mıydı, uçmuş muydu? İkisi de olur — şu an baktın ya, o yeter.`,
    (s) => `“${s}” şimdiden solduysa dert etme. Değiştirdiğimiz refleks tam da bu — bir kez daha hisset, acele etmeden.`,
    (s) => `Durduk yere geldim, biliyorum: “${s}”. Güzel şeyler ikinci bakışı hak ediyor, o kadar.`,
    (s) => `“${s}” yazdın, geçtin gittin. Normal. Ama hâlâ senin — bir nefeslik geri al.`,
  ],
  en: [
    (s) => `“${s}” — you've probably forgotten this by now, I know. It's ok; forgetting is the old habit. You just remembered — that's the whole point.`,
    (s) => `Remember “${s}”? That was today. It slid by like nothing — go back and hold it a few more seconds.`,
    (s) => `Small check-in: “${s}”. Still with you, or already gone? Either is fine — you just looked, and that's enough.`,
    (s) => `If “${s}” has already faded, don't sweat it. That's exactly the reflex we're changing — feel it once more, no rush.`,
    (s) => `Showing up out of nowhere, I know: “${s}”. Good things deserve a second look, that's all.`,
    (s) => `You wrote “${s}” and moved on. Fair. But it's still yours — take it back for a breath.`,
  ],
};

// The moment of arrival is deliberately unguessable: log-uniform between
// ~2 and ~45 minutes, so short waits stay common but long ones stretch the
// tail. The old fixed 75 seconds had become a pattern the brain memorised
// and stopped reading — surprise is what makes the reminder land again.
// Clamped so a late-evening log can't fire past ~23:00; if the day is
// nearly over it falls back to a short 2–8 minute window.
function resurfaceDelaySeconds(now = new Date()): number {
  const MIN_S = 120;
  const MAX_S = 45 * 60;
  const cutoff = new Date(now);
  cutoff.setHours(23, 0, 0, 0);
  const untilCutoff = Math.floor((cutoff.getTime() - now.getTime()) / 1000);
  if (untilCutoff <= MIN_S * 2) {
    return 120 + Math.floor(Math.random() * 360); // 2–8 min, whenever it's this late
  }
  const max = Math.min(MAX_S, untilCutoff);
  const r = Math.exp(Math.log(MIN_S) + Math.random() * (Math.log(max) - Math.log(MIN_S)));
  return Math.round(r);
}

// Re-surface a just-logged positive later the same day, at a random moment,
// so it actually lands instead of being forgotten in 5 seconds. Line picked
// at random each time — this fires once per event, not once per day, so
// date-based repetition isn't a concern here.
export async function scheduleResurface(
  text: string,
  lang: Lang,
  apiKey = ""
): Promise<void> {
  const clean = text.trim();
  if (!clean) return;
  const granted = await requestPermissions();
  if (!granted) return;
  const short = clean.length > 90 ? clean.slice(0, 88) + "…" : clean;
  // Weekly voice pack when available (cache read — cheap even at log time),
  // static template pool as the floor.
  const pack = await getVoicePack(lang, apiKey).catch(() => null);
  const body = pack?.resurface.length
    ? fillMoment(pack.resurface[Math.floor(Math.random() * pack.resurface.length)], short)
    : RESURFACE_LINES[lang][Math.floor(Math.random() * RESURFACE_LINES[lang].length)](short);
  await Notifications.scheduleNotificationAsync({
    // `kind` marks this so the daily rescheduler's cleanup spares it.
    content: { title: APP_TITLE, body, data: { kind: "resurface" } },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: resurfaceDelaySeconds(),
    },
  });
}

// Shared landing for any text captured outside the normal LogEventSheet flow
// (a notification reply, a Siri capture drained on foreground) — logs it,
// schedules the resurface, and best-effort tags a real vision match. Never
// force-fits a default card.
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

  try {
    const s0 = await loadSettings();
    scheduleResurface(value, s0.language, s0.apiKey);
    if (s0.apiKey && s0.visionCards.length > 0) {
      const m = await matchEventToVision(s0.apiKey, value, s0.visionCards, s0.language);
      if (m.cardId) {
        await updateEvent(event.id, { matchedCardId: m.cardId, matchReason: m.reason });
      }
    }
  } catch {}
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
