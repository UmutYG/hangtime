@AGENTS.md

# Publishing workflow

- After making a change, do not push or build automatically. Ask for a publishing prompt and wait for explicit approval before publishing anything.
- "Publish" means both together: `git push` to GitHub **and** cut a new build via `scripts/publish.sh` (bumps build number, archives, uploads to TestFlight/App Store Connect).
- Once approved, run both — don't stop at just the GitHub push unless the user asked for git only.
