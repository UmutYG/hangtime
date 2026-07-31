// Local-date helpers keyed as YYYY-MM-DD (no timezone surprises).

export function dateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(key: string, delta: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d + delta);
  return dateKey(date);
}

// Monday of the current calendar week, as a date key. Anything on or after
// this belongs to "this week" and is still unfolding; only what's strictly
// before it counts as a past, completed week.
export function currentWeekStart(): string {
  const now = new Date();
  const dow = now.getDay(); // 0=Sun..6=Sat
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  return addDays(dateKey(now), diffToMonday);
}

export function prettyDate(d: Date = new Date(), locale?: string): string {
  return d.toLocaleDateString(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function keyToDate(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function shortWeekday(key: string, locale?: string): string {
  return keyToDate(key).toLocaleDateString(locale, { weekday: "short" });
}

// A stable, date-derived index — NOT a rotating counter. Content picked this
// way stays tied to the actual calendar day, so re-scheduling notifications
// (which happens every time the app opens) can't reset "today" back to the
// same pool entry it always starts from.
export function dateIndex(key: string, mod: number, salt = ""): number {
  let h = 0;
  const s = key + salt;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % mod;
}
