@AGENTS.md
@PHILOSOPHY.md

# Verifying changes

- Verify on the **iOS Simulator** (iPhone 17 Pro, udid `458BE90F-DDD7-44A4-A386-F3545EC719D3`) — that is the user's preferred surface. Boot with `xcrun simctl boot <udid>` if shutdown, then `attach` so the user can watch.
- **Simulator builds must be Release**, not Debug: the prebuilt RN-core debug tarball is missing Fabric symbols and Debug sim builds fail to link (the "SwiftUICore not an allowed client" error is a red herring). Use `npx expo run:ios --configuration Release --device <udid>` with `LANG=en_US.UTF-8` exported.
- Because a Release sim build takes minutes, the Expo **web preview** (`hangtime-web` launch config, port 8090) is still the right tool for fast engine/logic iteration. Use the simulator for the real check before proposing a publish.
- Engine changes must also pass `npx vitest run` and `npx tsc --noEmit`.

# Publishing workflow

- After making a change, do not push or build automatically. Ask for a publishing prompt and wait for explicit approval before publishing anything.
- "Publish" means both together: `git push` to GitHub **and** cut a new build via `scripts/publish.sh` (bumps build number, archives, uploads to TestFlight/App Store Connect).
- Once approved, run both — don't stop at just the GitHub push unless the user asked for git only.
