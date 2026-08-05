#!/usr/bin/env node
// Print the current state of the real app, straight off the phone.
//
// The app already pushes its store to iCloud every time it goes to the
// background, and iCloud already mirrors that container onto this Mac. So
// there is nothing to export, upload, or paste: this reads the same file the
// phone wrote and renders it as a digest dense enough to reason about the
// training algorithm from.
//
//   node scripts/snapshot.mjs          digest to stdout
//   node scripts/snapshot.mjs --raw    also copy the raw JSON into .roof-data/
//
// Deliberately dependency-free and engine-free: this has to keep working
// months from now without a build step, and it must never be something that
// can break the app. It reads. That's all.

import { existsSync, copyFileSync, readFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const CONTAINER = path.join(
  homedir(),
  'Library/Mobile Documents/iCloud~com~umutyg~hangtime'
);
const STORE = path.join(CONTAINER, 'hangtime-store.json');
const OUT_DIR = path.join(import.meta.dirname, '..', '.roof-data');

// Reading in place can block on iCloud materialising the file; copying out
// first is instant and also leaves a stable artifact to diff against later.
function loadStore() {
  if (!existsSync(STORE)) {
    console.error(
      `No store at ${STORE}\n\n` +
        `The file appears once the app has been to the background at least once\n` +
        `on a device signed into this iCloud account. Open Roof, swipe up, wait a\n` +
        `few seconds, then re-run.`
    );
    process.exit(1);
  }
  mkdirSync(OUT_DIR, { recursive: true });
  const local = path.join(OUT_DIR, 'hangtime-store.json');
  copyFileSync(STORE, local);
  return { store: JSON.parse(readFileSync(local, 'utf8')), local };
}

const n = (x, d = 1) => (x == null ? '—' : Number(x).toFixed(d).replace(/\.0+$/, ''));
const pct = (x) => (x == null ? '—' : `${Math.round(x * 100)}%`);

function ago(iso) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  const h = ms / 36e5;
  if (h < 1) return `${Math.round(ms / 6e4)}m ago`;
  if (h < 48) return `${Math.round(h)}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

// Calendar days, not elapsed hours — a session logged this morning is "today",
// not "-1d ago".
function daysSince(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const then = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((today - then) / 864e5);
}

const daysAgo = (dateStr) => {
  const d = daysSince(dateStr);
  return d === 0 ? 'today' : d === 1 ? 'yesterday' : `${d}d ago`;
};

// Working sets only — warmups say nothing about whether the prescription fit.
function setsLine(sets = []) {
  const work = sets.filter((s) => !s.isWarmup);
  if (!work.length) return '—';
  const reps = work.map((s) => (s.actualReps === s.targetReps ? `${s.actualReps}` : `${s.actualReps}/${s.targetReps}`));
  const loads = [...new Set(work.map((s) => s.loadKg).filter((l) => l > 0))];
  const load = loads.length === 1 ? ` @${n(loads[0])}kg` : loads.length ? ` @${loads.map((l) => n(l)).join('/')}kg` : '';
  const hit = work.reduce((a, s) => a + s.actualReps, 0);
  const aim = work.reduce((a, s) => a + s.targetReps, 0);
  return `${reps.join(' ')}${load}  (${hit}/${aim})`;
}

function tuneLine(t) {
  if (!t) return '  tune: none yet';
  const bits = [
    `repAdj ${t.repAdj > 0 ? '+' : ''}${t.repAdj}`,
    `rest ${t.restSec}s`,
    t.lastOutcome ? `last read "${t.lastOutcome}"` : null,
    t.lastCompletionPct != null ? `completion ${pct(t.lastCompletionPct)}` : null,
    t.lastDropOff != null ? `dropoff ${pct(t.lastDropOff)}` : null,
    t.lastRestOverage != null ? `rest overage ${pct(t.lastRestOverage)}` : null,
  ].filter(Boolean);
  return `  tune: ${bits.join(' · ')}`;
}

function main() {
  const { store: s, local } = loadStore();
  const L = [];
  const p = (x = '') => L.push(x);

  p(`ROOF SNAPSHOT`);
  p(`store written ${s.updatedAt} (${ago(s.updatedAt)}) · schema v${s.version}`);
  p(`local copy: ${path.relative(process.cwd(), local)}`);
  p();

  const pr = s.profile;
  if (pr) {
    const eq = pr.equipment || {};
    p(`PROFILE`);
    p(`  bodyweight ${n(pr.bodyweightKg)}kg · starting max ${pr.startingMax} · since ${pr.createdAt}`);
    p(`  equipment ${eq.mode}${eq.fixedLoadKg ? ` ${n(eq.fixedLoadKg)}kg` : ''}${eq.smallestPlateKg ? ` (plate ${n(eq.smallestPlateKg, 2)}kg)` : ''}`);
    p(`  training days ${(pr.trainingDays || []).join(',')}  (0=Sun)`);
    p();
  }

  // ---- PULL-UPS ----
  const st = s.state || {};
  const w = st.weighted || {};
  p(`PULL-UPS   cycle ${st.cycle} · week ${st.week} · session ${st.sessionInWeek} in week`);
  p(`  last session ${st.lastSessionDate} (${daysAgo(st.lastSessionDate)}) · calibrated ${st.calibrated} · deload pending ${st.pendingDeload}`);
  p(`  best max set ${st.bwBestMaxSet} · last test ${st.bwLastTestReps} · e1RM ${n(st.e1rmKg)}kg · lifetime ${s.lifetimeReps} reps`);
  p(`  weighted ${n(w.loadKg)}kg × ${w.setCount} sets, rest ${w.restSec}s · last reps [${(w.lastReps || []).join(',')}]`);
  p(`  streaks: fail ${w.failStreak} · grind ${w.grindStreak} · stall ${w.stallCount} · sessionsAtLoad ${w.sessionsAtLoad}`);
  p(`  flags: microload ${w.microload} · backoffNext ${w.backoffNext} · suggestMoreLoad ${w.suggestMoreLoad}`);
  p(tuneLine(st.volumeTune));
  p();
  p(`  sessions (${(s.sessions || []).length}):`);
  for (const x of (s.sessions || []).slice(-12)) {
    p(`    ${x.date}  ${String(x.dayKind).padEnd(10)} c${x.cycle}w${x.week}  ${setsLine(x.sets).padEnd(34)} ${x.lastSetEffort || ''}${x.progressionExempt ? ' [exempt]' : ''}`);
  }
  p();

  // ---- PUSH-UPS ----
  const ps = s.pushState || {};
  p(`PUSH-UPS   cycle ${ps.cycle} · week ${ps.week} · session ${ps.sessionInWeek} in week`);
  p(`  last session ${ps.lastSessionDate} (${daysAgo(ps.lastSessionDate)})`);
  p(`  best max set ${ps.bestMaxSet} · last test ${ps.lastTestReps} · starting max ${s.pushStartingMax} · lifetime ${s.pushLifetimeReps} reps`);
  p(tuneLine(ps.volumeTune));
  p();
  p(`  sessions (${(s.pushSessions || []).length}):`);
  for (const x of (s.pushSessions || []).slice(-12)) {
    p(`    ${x.date}  ${String(x.dayKind).padEnd(12)} c${x.cycle}w${x.week}  ${setsLine(x.sets)}${x.progressionExempt ? ' [exempt]' : ''}`);
  }
  p();

  // ---- RUNS ----
  const runs = (s.runs || []).slice().sort((a, b) => a.date.localeCompare(b.date));
  p(`RUNS (${runs.length})`);
  for (const r of runs.slice(-10)) {
    const pace = r.distanceKm > 0 ? r.durationSec / 60 / r.distanceKm : null;
    p(`    ${r.date}  ${n(r.distanceKm, 2)}km  ${Math.round(r.durationSec / 60)}min  ${pace ? n(pace, 2) + ' min/km' : ''}  [${r.source}]`);
  }
  if (runs.length > 10) p(`    … ${runs.length - 10} older`);
  p();

  // ---- PRs / joints / tests ----
  p(`PRs (${(s.prs || []).length})`);
  for (const x of s.prs || []) p(`    ${x.date}  ${x.kind} ${n(x.value)}`);
  p();

  if ((s.jointLog || []).length) {
    p(`JOINTS (${s.jointLog.length})`);
    for (const j of s.jointLog.slice(-8)) p(`    ${j.date}  ${j.feel}`);
    p();
  }

  if ((s.tests || []).length) {
    p(`TESTS (${s.tests.length})`);
    for (const t of s.tests.slice(-8)) p(`    ${JSON.stringify(t)}`);
    p();
  }

  // ---- SUPPLEMENTS ----
  const items = s.supItems || [];
  const days = (s.supDays || []).slice().sort((a, b) => a.date.localeCompare(b.date));
  p(`SUPPLEMENTS  ${items.filter((i) => i.active !== false).length} active of ${items.length} · ${days.length} logged days`);
  for (const d of days.slice(-10)) {
    const took = Object.keys(d.taken || {}).length;
    const skip = Object.keys(d.skipped || {}).length;
    p(`    ${d.date}  took ${took}, skipped ${skip}   ${Object.entries(d.taken || {}).map(([k, v]) => `${k}@${v}`).join(' ')}`);
  }
  p();

  const trash = (s.trash || []).length + (s.pushTrash || []).length + (s.deletedRunIds || []).length;
  p(`OTHER  appMode ${s.appMode} · healthEnabled ${s.healthEnabled} · externalReadiness ${s.externalReadiness ?? 'none'} · trashed ${trash}`);

  console.log(L.join('\n'));
}

main();
