#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${DEPLOY_ENV_FILE:-$ROOT_DIR/.deploy.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing deploy config: $ENV_FILE" >&2
  echo "Copy .deploy.env.example to .deploy.env and fill in the Aliyun settings." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

: "${ALIYUN_HOST:?Missing ALIYUN_HOST}"
: "${ALIYUN_DEPLOY_PATH:?Missing ALIYUN_DEPLOY_PATH}"

ALIYUN_USER="${ALIYUN_USER:-root}"
ALIYUN_PORT="${ALIYUN_PORT:-22}"
LOCAL_DB="${LOCAL_DB:-db/mail.sqlite}"
REMOTE_DB="${REMOTE_DB:-$ALIYUN_DEPLOY_PATH/db/mail.sqlite}"
LOCAL_BACKUP_DIR="${LOCAL_BACKUP_DIR:-$ROOT_DIR/db/local-backups}"

if [[ "$LOCAL_DB" != /* ]]; then
  LOCAL_DB="$ROOT_DIR/$LOCAL_DB"
fi

SSH_TARGET="$ALIYUN_USER@$ALIYUN_HOST"
SSH_OPTS=(-p "$ALIYUN_PORT" -o StrictHostKeyChecking=accept-new)
SCP_OPTS=(-P "$ALIYUN_PORT" -o StrictHostKeyChecking=accept-new)

if [[ -n "${ALIYUN_SSH_KEY:-}" ]]; then
  SSH_OPTS+=(-i "$ALIYUN_SSH_KEY")
  SCP_OPTS+=(-i "$ALIYUN_SSH_KEY")
fi

TMP_DIR="$(mktemp -d)"
SNAPSHOT="$TMP_DIR/mail.sqlite"
REMOTE_TMP="/tmp/mail.sqlite.pull.$(date +%Y%m%d%H%M%S).$$"

cleanup() {
  rm -rf "$TMP_DIR"
  ssh "${SSH_OPTS[@]}" "$SSH_TARGET" "rm -f '$REMOTE_TMP'" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "Creating remote SQLite snapshot from $SSH_TARGET:$REMOTE_DB"
ssh "${SSH_OPTS[@]}" "$SSH_TARGET" bash -s -- "$ALIYUN_DEPLOY_PATH" "$REMOTE_DB" "$REMOTE_TMP" <<'REMOTE_SH'
set -euo pipefail

deploy_path="$1"
remote_db="$2"
remote_tmp="$3"

if [[ ! -f "$remote_db" ]]; then
  echo "Remote SQLite database not found: $remote_db" >&2
  exit 1
fi

python_bin="python3"
if [[ -x "$deploy_path/venv/bin/python" ]]; then
  python_bin="$deploy_path/venv/bin/python"
elif command -v python3.12 >/dev/null 2>&1; then
  python_bin="python3.12"
elif command -v python3.11 >/dev/null 2>&1; then
  python_bin="python3.11"
elif command -v python3.10 >/dev/null 2>&1; then
  python_bin="python3.10"
elif command -v python3.9 >/dev/null 2>&1; then
  python_bin="python3.9"
fi

"$python_bin" - "$remote_db" "$remote_tmp" <<'PY'
import os
import sqlite3
import sys

src, dst = sys.argv[1:3]
source = sqlite3.connect(src)
target = sqlite3.connect(dst)
try:
    if hasattr(source, "backup"):
        with target:
            source.backup(target)
    else:
        source.close()
        target.close()
        os.system(f"cp {src!r} {dst!r}")
finally:
    try:
        target.close()
    except Exception:
        pass
    try:
        source.close()
    except Exception:
        pass
PY
REMOTE_SH

echo "Downloading remote SQLite snapshot"
scp "${SCP_OPTS[@]}" "$SSH_TARGET:$REMOTE_TMP" "$SNAPSHOT"

mkdir -p "$(dirname "$LOCAL_DB")" "$LOCAL_BACKUP_DIR"

if [[ -f "$LOCAL_DB" ]]; then
  BACKUP_FILE="$LOCAL_BACKUP_DIR/mail.sqlite.$(date +%Y%m%d%H%M%S).bak"
  cp "$LOCAL_DB" "$BACKUP_FILE"
  echo "Local database backed up to $BACKUP_FILE"
fi

cp "$SNAPSHOT" "$LOCAL_DB"
chmod 600 "$LOCAL_DB" || true

echo "SQLite database pulled from server to $LOCAL_DB"
