#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REMOTE="${1:-origin}"
BRANCH="${2:-main}"

cd "$ROOT_DIR"
git push "$REMOTE" "$BRANCH"
"$ROOT_DIR/scripts/sync_sqlite_to_server.sh"
