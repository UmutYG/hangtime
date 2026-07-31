import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { reminderBody, reminderGroups, statusOf, supDayFor } from '../engine/supplements';
import type { SupplementDay, SupplementItem } from '../engine/types';

// Daily supplement reminders.
//
// Grouped by the minute they share, so the three things that belong to the
// first meal are one nudge rather than three. Anything already answered today —
// taken or skipped — drops out of today's reminders entirely: a reminder for
// something you've dealt with is exactly the noise that gets notifications
// switched off for good.

const ROOM = 'supplements';
const DAYS_AHEAD = 3;

/** every room tags its notifications so the others can schedule without collisions */
export function isSupplementNotification(n: Notifications.NotificationRequest): boolean {
  return (n.content?.data as { room?: string } | undefined)?.room === ROOM;
}

/**
 * `ask` is false everywhere except the supplements room itself: launching Roof
 * should never open with a permission dialog for a room you haven't visited.
 * When permission is already granted the schedule stays in sync silently.
 */
async function ensurePermission(ask: boolean): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!ask || !current.canAskAgain) return false;
    const asked = await Notifications.requestPermissionsAsync();
    return asked.granted;
  } catch {
    return false;
  }
}

async function cancelOurs(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter(isSupplementNotification)
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
  );
}

function parseHhMm(at: string): { hour: number; minute: number } | null {
  const m = /^(\d{2}):(\d{2})$/.exec(at);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

/**
 * Rebuild the supplement reminder schedule from the current stack and log.
 *
 * Safe to call on every foreground: it cancels only its own notifications
 * (other rooms are tagged differently and left alone) and re-derives the next
 * few days from scratch.
 */
export async function syncSupplementReminders(
  items: SupplementItem[],
  days: SupplementDay[],
  opts: { ask?: boolean; now?: Date } = {}
): Promise<number> {
  const { ask = false, now = new Date() } = opts;
  const groups = reminderGroups(items);
  if (groups.length === 0) {
    await cancelOurs();
    return 0;
  }
  if (!(await ensurePermission(ask))) return 0;

  await cancelOurs();

  let scheduled = 0;
  for (let d = 0; d < DAYS_AHEAD; d++) {
    const day = new Date(now);
    day.setDate(now.getDate() + d);
    const dayIso = isoOf(day);
    const logged = supDayFor(days, dayIso);

    for (const group of groups) {
      const hhmm = parseHhMm(group.at);
      if (!hhmm) continue;

      // today only: drop anything already taken or skipped, and skip a slot
      // whose moment has already passed
      const pending =
        d === 0 ? group.items.filter((i) => statusOf(logged, i.id) === null) : group.items;
      if (pending.length === 0) continue;

      const when = new Date(day);
      when.setHours(hhmm.hour, hhmm.minute, 0, 0);
      if (when.getTime() <= now.getTime()) continue;

      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: pending.length === 1 ? pending[0].name : `${pending.length} to take`,
            body: reminderBody({ at: group.at, items: pending }),
            data: { room: ROOM, at: group.at },
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when },
        });
        scheduled++;
      } catch {
        /* one bad slot shouldn't take the rest of the schedule down */
      }
    }
  }
  return scheduled;
}

/** Called when the stack empties or reminders are turned off wholesale. */
export async function clearSupplementReminders(): Promise<void> {
  try {
    await cancelOurs();
  } catch {
    /* nothing scheduled / notifications unavailable */
  }
}
