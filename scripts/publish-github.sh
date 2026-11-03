#!/usr/bin/env bash
# Optional local one-time GitHub publish; requires authenticated GitHub CLI (`gh auth login`).
set -euo pipefail
cd "$(dirname "$0")/.."
if ! command -v gh >/dev/null 2>&1; then echo "Install GitHub CLI (gh) and run gh auth login first" >&2;exit 1;fi
if [ ! -d .git ]; then git init -b main;fi
git add -A
if ! git diff --staged --quiet;then git commit -m "feat: initialize Veyra browser workspace MVP";fi
if gh repo view iAlirezaaa/veyra-browser >/dev/null 2>&1; then
  git remote get-url origin >/dev/null 2>&1 || git remote add origin https://github.com/iAlirezaaa/veyra-browser.git
  git push -u origin main
else
  gh repo create iAlirezaaa/veyra-browser --public --source=. --remote=origin --push --description "Local-first bilingual browser workspace: tabs, AI chats, Laya decision layer, new tab dashboard"
fi
