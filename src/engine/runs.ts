// Running module — pure logic, no React Native imports.
// Runs are tracked data (imported from Apple Health or logged manually);
// they never influence the pull-up engine.

export interface Run {
  id: string; // HealthKit UUID for imported runs, manual-… otherwise
  date: string; // ISO date (YYYY-MM-DD)
  distanceKm: number;
  durationSec: number;
  calories?: number;
  avgHrBpm?: number;
  source: 'health' | 'manual';
}

/** seconds per km; null when the run can't produce a sane pace */
export function paceSecPerKm(run: Pick<Run, 'distanceKm' | 'durationSec'>): number | null {
  if (run.distanceKm <= 0.05 || run.durationSec <= 0) return null;
  const pace = run.durationSec / run.distanceKm;
  return pace > 90 && pace < 1800 ? pace : null; // 1:30–30:00 /km sanity band
}

export function fmtPace(secPerKm: number | null): string {
  if (secPerKm === null) return '—';
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${s.toString().padStart(2, '0')} /km`;
}

export function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * HealthKit clients disagree on workout distance units (miles vs meters).
 * Nobody runs 200+ miles in one workout and sub-200-meter "runs" are noise,
 * so: value > 200 → meters, otherwise → miles.
 */
export function normalizeDistanceKm(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  const km = raw > 200 ? raw / 1000 : raw * 1.60934;
  return Math.round(km * 100) / 100;
}

/** Merge imported runs into existing ones — dedupes by id, honors deletions. */
export function mergeRuns(existing: Run[], incoming: Run[], deletedIds: string[]): Run[] {
  const deleted = new Set(deletedIds);
  const byId = new Map(existing.map((r) => [r.id, r]));
  for (const run of incoming) {
    if (deleted.has(run.id)) continue;
    if (!byId.has(run.id)) byId.set(run.id, run);
  }
  return [...byId.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export interface RunStats {
  thisWeekKm: number;
  last4wKm: number;
  totalKm: number;
  totalRuns: number;
  longestKm: number;
  /** best (lowest) pace among runs ≥ 2 km */
  bestPaceSecPerKm: number | null;
}

function mondayOf(dateIso: string): string {
  const d = new Date(dateIso + 'T12:00:00');
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export function runStats(runs: Run[], todayIso: string): RunStats {
  const thisMonday = mondayOf(todayIso);
  const cutoff4w = new Date(todayIso + 'T12:00:00');
  cutoff4w.setDate(cutoff4w.getDate() - 28);
  const cut4w = cutoff4w.toISOString().slice(0, 10);

  let thisWeekKm = 0;
  let last4wKm = 0;
  let totalKm = 0;
  let longestKm = 0;
  let bestPace: number | null = null;

  for (const run of runs) {
    totalKm += run.distanceKm;
    if (run.distanceKm > longestKm) longestKm = run.distanceKm;
    if (mondayOf(run.date) === thisMonday) thisWeekKm += run.distanceKm;
    if (run.date >= cut4w) last4wKm += run.distanceKm;
    if (run.distanceKm >= 2) {
      const pace = paceSecPerKm(run);
      if (pace !== null && (bestPace === null || pace < bestPace)) bestPace = pace;
    }
  }

  const round = (v: number) => Math.round(v * 10) / 10;
  return {
    thisWeekKm: round(thisWeekKm),
    last4wKm: round(last4wKm),
    totalKm: round(totalKm),
    totalRuns: runs.length,
    longestKm: round(longestKm),
    bestPaceSecPerKm: bestPace,
  };
}

/** km per ISO week (Monday key), most recent `weeks` entries, oldest first */
export function weeklyKmSeries(
  runs: Run[],
  todayIso: string,
  weeks: number
): Array<{ date: string; value: number }> {
  const buckets = new Map<string, number>();
  const start = new Date(mondayOf(todayIso) + 'T12:00:00');
  start.setDate(start.getDate() - 7 * (weeks - 1));
  for (let i = 0; i < weeks; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + 7 * i);
    buckets.set(d.toISOString().slice(0, 10), 0);
  }
  for (const run of runs) {
    const key = mondayOf(run.date);
    if (buckets.has(key)) buckets.set(key, buckets.get(key)! + run.distanceKm);
  }
  return [...buckets.entries()].map(([date, value]) => ({
    date,
    value: Math.round(value * 10) / 10,
  }));
}
