#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLIST_DIR="$HOME/Library/LaunchAgents"
PLIST_PATH="$PLIST_DIR/com.mail.sqlite-sync.plist"
LOG_DIR="$ROOT_DIR/logs"
PYTHON_BIN="${PYTHON_BIN:-/usr/bin/python3}"

if [[ ! -f "$ROOT_DIR/.deploy.env" ]]; then
  echo "Missing $ROOT_DIR/.deploy.env" >&2
  echo "Copy .deploy.env.example to .deploy.env and fill in your Aliyun settings first." >&2
  exit 1
fi

mkdir -p "$PLIST_DIR" "$LOG_DIR"

cat > "$PLIST_PATH" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.mail.sqlite-sync</string>
  <key>ProgramArguments</key>
  <array>
    <string>$PYTHON_BIN</string>
    <string>$ROOT_DIR/scripts/watch_sqlite_and_sync.py</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$ROOT_DIR</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>$LOG_DIR/sqlite-sync.log</string>
  <key>StandardErrorPath</key>
  <string>$LOG_DIR/sqlite-sync.err.log</string>
</dict>
</plist>
PLIST

launchctl bootout "gui/$(id -u)" "$PLIST_PATH" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "$PLIST_PATH"
launchctl kickstart -k "gui/$(id -u)/com.mail.sqlite-sync"

echo "Installed macOS SQLite sync agent."
echo "Logs:"
echo "  $LOG_DIR/sqlite-sync.log"
echo "  $LOG_DIR/sqlite-sync.err.log"
