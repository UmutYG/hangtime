@AGENTS.md
@PHILOSOPHY.md

# What this app is

**Roof** — a container for one life, one room per area (`src/screens/RoofHomeScreen.tsx` is the map). Rooms today: **Body** (`BodyAreaScreen` → the pull/push/run spaces, shared readiness engine in `src/engine/`), **Mind** (`src/mind/` — the Slide app ported as a module, own 4-tab shell, own storage keys, own reminders), **Supplements** (`src/engine/supplements.ts` + `Sup*Screen`s). Navigation is two-level: home → area → space, via `src/hooks/useNav.tsx`; `RoofBar` always goes up exactly one level.

Adding a room = a new `AppMode`, a theme identity, a home card, and a shell. Never bolt a new life area onto an existing room.

Visible brand name lives in exactly three places: `BRAND` in `src/theme.ts`, `name` in `app.json`, `CFBundleDisplayName` in `ios/Hangtime/Info.plist`. Bundle id, slug, repo name, iCloud container and AsyncStorage keys all still say `hangtime` **on purpose** — renaming them orphans TestFlight lineage and user data.

# Verifying changes

- Verify on the **iOS Simulator ONLY** (**iPhone 17**, udid `028FB4DE-2CEA-4EEA-91A1-83D6CD9C5321` — the user's standing test device since 2026-07-31; do not switch devices, the app stays installed there between sessions). **Never use localhost / the web preview for testing** — user instruction 2026-07-31. Boot with `xcrun simctl boot <udid>` if shutdown, then `attach` so the user can watch.
- **Simulator builds must be Release**, not Debug: the prebuilt RN-core debug tarball is missing Fabric symbols and Debug sim builds fail to link (the "SwiftUICore not an allowed client" error is a red herring). Use `npx expo run:ios --configuration Release --device <udid>` with `LANG=en_US.UTF-8` exported. If `expo run:ios` errors after a successful build (osascript step), launch the built .app from DerivedData directly via the simulator tool's `launch`.
- Simulator tap coordinates are in POINTS (402×874 on iPhone 17), not screenshot pixels.
- Engine changes must also pass `npx vitest run` and `npx tsc --noEmit`.

# Publishing workflow

- After making a change, do not push or build automatically. Ask for a publishing prompt and wait for explicit approval before publishing anything.
- "Publish" means both together: `git push` to GitHub **and** cut a new build via `scripts/publish.sh` (bumps build number, archives, uploads to TestFlight/App Store Connect).
- Once approved, run both — don't stop at just the GitHub push unless the user asked for git only.
