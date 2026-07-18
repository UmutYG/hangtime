#!/bin/bash
# Build the web app and publish dist/ to the gh-pages branch.
# Usage: ./scripts/deploy-web.sh
set -euo pipefail
cd "$(dirname "$0")/.."

npx expo export --platform web

cd dist
touch .nojekyll
git init -q
git checkout -q -b gh-pages
git add -A
git commit -qm "deploy $(date +%Y-%m-%d_%H%M)"
git push -f git@github.com:umutyg/hangtime.git gh-pages
cd ..
rm -rf dist/.git
echo "Deployed → https://umutyg.github.io/hangtime"
