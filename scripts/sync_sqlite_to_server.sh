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
REMOTE_BACKUP_DIR="${REMOTE_BACKUP_DIR:-$ALIYUN_DEPLOY_PATH/db/backups}"
REMOTE_STOP_COMMAND="${REMOTE_STOP_COMMAND:-systemctl stop mail-system 2>/dev/null || true}"
REMOTE_RESTART_COMMAND="${REMOTE_RESTART_COMMAND:-systemctl restart mail-system 2>/dev/null || (cd $ALIYUN_DEPLOY_PATH && ./restart.sh)}"
REMOTE_CHOWN_COMMAND="${REMOTE_CHOWN_COMMAND:-}"

if [[ "$LOCAL_DB" != /* ]]; then
  LOCAL_DB="$ROOT_DIR/$LOCAL_DB"
fi

if [[ ! -f "$LOCAL_DB" ]]; then
  echo "Local SQLite database not found: $LOCAL_DB" >&2
  exit 1
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
REMOTE_TMP="/tmp/mail.sqlite.$(date +%Y%m%d%H%M%S).$$"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

python3 - "$LOCAL_DB" "$SNAPSHOT" <<'PY'
import os
import sqlite3
import sys

src, dst = sys.argv[1:3]
os.makedirs(os.path.dirname(dst), exist_ok=True)

source = sqlite3.connect(src)
target = sqlite3.connect(dst)
try:
    with target:
        source.backup(target)
finally:
    target.close()
    source.close()
PY

echo "Uploading SQLite snapshot to $SSH_TARGET:$REMOTE_TMP"
scp "${SCP_OPTS[@]}" "$SNAPSHOT" "$SSH_TARGET:$REMOTE_TMP"

ssh "${SSH_OPTS[@]}" "$SSH_TARGET" bash -s -- \
  "$REMOTE_TMP" \
  "$REMOTE_DB" \
  "$REMOTE_BACKUP_DIR" \
  "$REMOTE_STOP_COMMAND" \
  "$REMOTE_RESTART_COMMAND" \
  "$REMOTE_CHOWN_COMMAND" <<'REMOTE_SH'
set -euo pipefail

remote_tmp="$1"
remote_db="$2"
backup_dir="$3"
stop_command="$4"
restart_command="$5"
chown_command="$6"
db_dir="$(dirname "$remote_db")"
backup_file="$backup_dir/mail.sqlite.$(date +%Y%m%d%H%M%S).bak"

mkdir -p "$db_dir" "$backup_dir"

if [[ -n "$stop_command" ]]; then
  bash -lc "$stop_command"
fi

if [[ -f "$remote_db" ]]; then
  cp "$remote_db" "$backup_file"
  echo "Remote database backed up to $backup_file"
fi

mv "$remote_tmp" "$remote_db"
chmod 600 "$remote_db" || true

if [[ -n "$chown_command" ]]; then
  bash -lc "$chown_command"
fi

if [[ -n "$restart_command" ]]; then
  bash -lc "$restart_command"
fi

echo "SQLite database synced to $remote_db"
REMOTE_SH
