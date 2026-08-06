@AGENTS.md
@PHILOSOPHY.md

# What this app is

**Roof** — a container for one life, one room per area (`src/screens/RoofHomeScreen.tsx` is the map). Rooms today: **Body** (`BodyAreaScreen` → the pull/push/run spaces, shared readiness engine in `src/engine/`), **Mind** (`src/mind/` — the Slide app ported as a module, own 4-tab shell, own storage keys, own reminders), **Supplements** (`src/engine/supplements.ts` + `Sup*Screen`s). Navigation is two-level: home → area → space, via `src/hooks/useNav.tsx`; `RoofBar` always goes up exactly one level.

Adding a room = a new `AppMode`, a theme identity, a home card, and a shell. Never bolt a new life area onto an existing room.

**Backup is central, not per-room.** `src/lib/roofBackup.ts` builds one snapshot (the store + every room's AsyncStorage keys); `src/lib/cloudSync.ts` pushes it to **iCloud** at `/roof-backup.json`, alongside the live store sync at `/hangtime-store.json`. There is no Supabase and no account — that was tried, the free-tier project was deleted out from under it, and the whole thing folded into iCloud (2026-08-02). A new room must add its keys to `MIND_KEYS` there rather than inventing its own cloud path. Two invariants: restores **merge** (never replace), and nothing pushes before it has pulled in that session, so an unseen backup can't be overwritten. Roof snapshots also mirror mind keys under `data` so the standalone Slide app can still read them.

Visible brand name lives in exactly three places: `BRAND` in `src/theme.ts`, `name` in `app.json`, `CFBundleDisplayName` in `ios/Hangtime/Info.plist`. Bundle id, slug, repo name, iCloud container and AsyncStorage keys all still say `hangtime` **on purpose** — renaming them orphans TestFlight lineage and user data.

# Looking at the real data

To discuss how the algorithm is actually behaving, **don't ask the user to describe or type anything** — read the real store:

```
node scripts/snapshot.mjs
```

That container is the phone's own iCloud folder, mirrored onto this Mac automatically, so the data is already here — the app writes it on every trip to the background. If the digest looks stale, the only fix is for the user to open Roof and background it once. Never edit anything under `~/Library/Mobile Documents/` — that folder syncs straight back to the phone.

The script copies the raw JSON to `.roof-data/` (gitignored) if you need fields the digest doesn't render. `roof-backup.json` in the same container also holds the **Mind** room's private entries — leave it alone unless the user asks, the training questions are all answered by the store.

**Never `copyFileSync` straight out of that container.** It truncates the destination before it reads, and an evicted iCloud file can stall for a minute — which destroys the cached copy that the failure was supposed to fall back on. This has already happened once. Use `safeCopy`/`loadStore` from `scripts/lib/store.mjs`, which stages through a temp file and renames.

# The Claude Desktop bridge

`scripts/mcp-server.mjs` is an MCP server (registered in Claude Desktop as `roof`) exposing `get_supplements`, `get_training` and `get_raw_store`, read-only, from the same iCloud store.

This exists because of a deliberate split the user asked for: **the app stays simple — it logs, reminds, and shows state — and anything worth actually thinking about happens in Claude with the real numbers.** That is why the supplements Body tab and its figure were deleted rather than improved. Before adding an analysis, explanation or insight screen to the app, assume the answer is that it belongs on this side of the bridge instead.

# Verifying changes

- Verify on the **iOS Simulator ONLY** (**iPhone 17**, udid `028FB4DE-2CEA-4EEA-91A1-83D6CD9C5321` — the user's standing test device since 2026-07-31; do not switch devices, the app stays installed there between sessions). **Never use localhost / the web preview for testing** — user instruction 2026-07-31. Boot with `xcrun simctl boot <udid>` if shutdown, then `attach` so the user can watch.
- **Simulator builds must be Release**, not Debug: the prebuilt RN-core debug tarball is missing Fabric symbols and Debug sim builds fail to link (the "SwiftUICore not an allowed client" error is a red herring). Use `npx expo run:ios --configuration Release --device <udid>` with `LANG=en_US.UTF-8` exported. If `expo run:ios` errors after a successful build (osascript step), launch the built .app from DerivedData directly via the simulator tool's `launch`.
- Simulator tap coordinates are in POINTS (402×874 on iPhone 17), not screenshot pixels.
- Engine changes must also pass `npx vitest run` and `npx tsc --noEmit`.
- **Add expo packages with `npx expo install <pkg>`, never `npm install`** — npm resolves to `latest`, which for an expo-* package means a build for a different SDK. It links and archives fine, then white-screens on launch with no error. `npx expo install --check` lists any package that has drifted.

# Publishing workflow

- After making a change, do not push or build automatically. Ask for a publishing prompt and wait for explicit approval before publishing anything.
- "Publish" means both together: `git push` to GitHub **and** cut a new build via `scripts/publish.sh` (bumps build number, archives, uploads to TestFlight/App Store Connect).
- Once approved, run both — don't stop at just the GitHub push unless the user asked for git only.
