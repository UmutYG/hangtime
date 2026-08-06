// Getting the real store off the phone, safely.
//
// Shared by snapshot.mjs, inject-sim.mjs and mcp-server.mjs because the safe
// way to do this is subtle enough that three copies would drift.
//
// The subtlety: `copyFileSync` truncates its destination before it reads the
// source. Reading out of iCloud can stall for a minute when the file has been
// evicted, so a naive copy destroys the cached copy on its way to failing —
// which is exactly the copy the failure was supposed to fall back on. (This
// happened, and the cache was gone.) So: copy to a temp file, and only move it
// into place once it has fully arrived.

import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

export const CONTAINER = path.join(
  homedir(),
  'Library/Mobile Documents/iCloud~com~umutyg~hangtime'
);
export const LIVE_STORE = path.join(CONTAINER, 'hangtime-store.json');

/** Pull `src` to `dest` without ever leaving `dest` damaged. */
export function safeCopy(src, dest) {
  const tmp = `${dest}.tmp-${process.pid}`;
  try {
    copyFileSync(src, tmp);
    renameSync(tmp, dest); // atomic on the same filesystem
    return true;
  } catch (err) {
    try {
      rmSync(tmp, { force: true });
    } catch {}
    throw err;
  }
}

/**
 * The store, preferring what the phone last wrote and falling back to the last
 * good local copy. `source` says which, so a caller never presents stale
 * numbers as current.
 */
export function loadStore(cacheDir) {
  mkdirSync(cacheDir, { recursive: true });
  const cache = path.join(cacheDir, 'hangtime-store.json');

  let source = 'cache';
  let copyError = null;
  if (existsSync(LIVE_STORE)) {
    try {
      safeCopy(LIVE_STORE, cache);
      source = 'icloud';
    } catch (err) {
      copyError = err;
    }
  }

  if (!existsSync(cache)) {
    throw new Error(
      copyError
        ? `iCloud didn't respond (${copyError.code ?? copyError.message}) and there is no local copy yet. ` +
          `Open the app, background it, and try again once iCloud has synced.`
        : `No store at ${LIVE_STORE}. Open the app and background it once.`
    );
  }

  return { store: JSON.parse(readFileSync(cache, 'utf8')), source, path: cache, copyError };
}
