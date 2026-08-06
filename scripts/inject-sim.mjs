#!/usr/bin/env node
// Load the real app data into the iOS Simulator, so a screen can be tested
// against the actual stack and the actual logged times rather than fixtures.
//
//   node scripts/inject-sim.mjs              real store from iCloud
//   node scripts/inject-sim.mjs <file.json>  any store JSON
//
// Writes straight into the simulator app's AsyncStorage. The app must have
// been launched at least once (so its container exists) and must be NOT
// RUNNING when this runs — a live app holds the store in memory and will
// overwrite this on its next save. Relaunch afterwards.
//
// Simulator only, by construction: it resolves the container through
// `simctl`, so there is no path here that can reach the real phone.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { safeCopy } from './lib/store.mjs';

const UDID = process.env.ROOF_SIM_UDID ?? '028FB4DE-2CEA-4EEA-91A1-83D6CD9C5321';
const BUNDLE = 'com.umutyg.hangtime';
const STORE_KEY = 'hangtime.store.v1';

const source =
  process.argv[2] ??
  path.join(homedir(), 'Library/Mobile Documents/iCloud~com~umutyg~hangtime/hangtime-store.json');

function main() {
  if (!existsSync(source)) {
    console.error(`No store to inject at ${source}`);
    process.exit(1);
  }

  let container;
  try {
    container = execFileSync('xcrun', ['simctl', 'get_app_container', UDID, BUNDLE, 'data'], {
      encoding: 'utf8',
    }).trim();
  } catch {
    console.error(
      `Couldn't find ${BUNDLE} on simulator ${UDID}.\nInstall and launch the app once, then re-run.`
    );
    process.exit(1);
  }

  // Copy out of iCloud first — reading in place can block on materialisation.
  // That copy can also time out if the file has been evicted, so fall back to
  // whatever snapshot.mjs last pulled down rather than failing the run: for
  // exercising a screen, yesterday's real data beats no real data.
  const staged = path.join(path.dirname(new URL(import.meta.url).pathname), '..', '.roof-data');
  mkdirSync(staged, { recursive: true });
  const local = path.join(staged, 'inject-source.json');
  const cached = path.join(staged, 'hangtime-store.json');
  try {
    safeCopy(source, local);
  } catch (err) {
    if (!existsSync(cached)) throw err;
    console.warn(`iCloud didn't respond (${err.code}) — using the cached copy instead.`);
    safeCopy(cached, local);
  }

  const raw = readFileSync(local, 'utf8');
  const parsed = JSON.parse(raw); // fail loudly rather than write garbage

  const dir = path.join(container, 'Library/Application Support', BUNDLE, 'RCTAsyncLocalStorage_V1');
  mkdirSync(dir, { recursive: true });
  const manifestPath = path.join(dir, 'manifest.json');
  const manifest = existsSync(manifestPath)
    ? JSON.parse(readFileSync(manifestPath, 'utf8'))
    : {};

  // Values over ~1 KB live in a file named for the md5 of their key; the
  // manifest keeps a null placeholder so the native side knows to look there.
  const hashed = createHash('md5').update(STORE_KEY).digest('hex');
  writeFileSync(path.join(dir, hashed), raw);
  manifest[STORE_KEY] = null;
  writeFileSync(manifestPath, JSON.stringify(manifest));

  const counts = [
    ['sessions', parsed.sessions?.length],
    ['pushSessions', parsed.pushSessions?.length],
    ['runs', parsed.runs?.length],
    ['supItems', parsed.supItems?.length],
    ['supDays', parsed.supDays?.length],
  ]
    .filter(([, n]) => n != null)
    .map(([k, n]) => `${k} ${n}`)
    .join(' · ');

  console.log(`Injected ${STORE_KEY} into ${UDID}`);
  console.log(`  ${counts}`);
  console.log(`  updatedAt ${parsed.updatedAt}`);
  console.log(`\nRelaunch the app to pick it up:`);
  console.log(`  xcrun simctl terminate ${UDID} ${BUNDLE} ; xcrun simctl launch ${UDID} ${BUNDLE}`);
}

main();
