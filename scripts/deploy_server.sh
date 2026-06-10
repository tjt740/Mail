#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICE_NAME="${SERVICE_NAME:-mail-system}"
PORT="${PORT:-8005}"
DATABASE_TYPE="${DATABASE_TYPE:-sqlite}"
RUN_USER="${RUN_USER:-$(id -un)}"
PYTHON_BIN="${PYTHON_BIN:-}"

sudo_cmd() {
  if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
    "$@"
  else
    sudo "$@"
  fi
}

install_packages() {
  if command -v dnf >/dev/null 2>&1; then
    sudo_cmd dnf install -y python3.11 python3.11-pip python3.11-devel git rsync gcc gcc-c++ make openssl-devel libffi-devel
  elif command -v yum >/dev/null 2>&1; then
    sudo_cmd yum install -y python3.11 python3.11-pip python3.11-devel git rsync gcc gcc-c++ make openssl-devel libffi-devel
  elif command -v apt-get >/dev/null 2>&1; then
    sudo_cmd apt-get update -qq
    sudo_cmd apt-get install -y python3 python3-pip python3-venv python3-dev git rsync build-essential libssl-dev libffi-dev
  else
    echo "Unsupported package manager. Install Python 3.9+, pip, git, and rsync manually." >&2
    exit 1
  fi
}

find_python() {
  if [[ -n "$PYTHON_BIN" ]]; then
    command -v "$PYTHON_BIN"
    return
  fi

  for candidate in python3.12 python3.11 python3.10 python3.9 python3; do
    if command -v "$candidate" >/dev/null 2>&1; then
      "$candidate" - <<'PY' >/dev/null 2>&1 && { command -v "$candidate"; return; }
import sys
raise SystemExit(0 if sys.version_info >= (3, 9) else 1)
PY
    fi
  done

  return 1
}

install_packages

PYTHON_BIN="$(find_python || true)"
if [[ -z "$PYTHON_BIN" ]]; then
  echo "Python 3.9+ was not found after package installation." >&2
  exit 1
fi

cd "$APP_DIR"
mkdir -p db logs

"$PYTHON_BIN" -m venv venv
# shellcheck disable=SC1091
source venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

sudo_cmd chown -R "$RUN_USER:$RUN_USER" "$APP_DIR"

SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
TMP_SERVICE="$(mktemp)"

cat > "$TMP_SERVICE" <<EOF
[Unit]
Description=Mail View System
After=network.target

[Service]
Type=simple
User=$RUN_USER
WorkingDirectory=$APP_DIR
Environment=PATH=$APP_DIR/venv/bin
Environment=DATABASE_TYPE=$DATABASE_TYPE
Environment=PORT=$PORT
Environment=PYTHONUNBUFFERED=1
ExecStart=$APP_DIR/venv/bin/python app.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo_cmd mv "$TMP_SERVICE" "$SERVICE_FILE"
sudo_cmd systemctl daemon-reload
sudo_cmd systemctl enable "$SERVICE_NAME"
sudo_cmd systemctl restart "$SERVICE_NAME"

echo "Deployed $SERVICE_NAME at $APP_DIR on port $PORT with $("$PYTHON_BIN" --version 2>&1)."
