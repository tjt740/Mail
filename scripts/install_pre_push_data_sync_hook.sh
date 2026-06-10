#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOOK_PATH="$ROOT_DIR/.git/hooks/pre-push"
MARKER="mail-sqlite-sync-hook"

if [[ ! -d "$ROOT_DIR/.git" ]]; then
  echo "This script must be run inside the project git repository." >&2
  exit 1
fi

mkdir -p "$(dirname "$HOOK_PATH")"

if [[ -f "$HOOK_PATH" ]] && grep -q "$MARKER" "$HOOK_PATH"; then
  echo "pre-push hook is already installed."
  exit 0
fi

if [[ -f "$HOOK_PATH" ]]; then
  cp "$HOOK_PATH" "$HOOK_PATH.backup.$(date +%Y%m%d%H%M%S)"
fi

cat > "$HOOK_PATH" <<HOOK
#!/usr/bin/env bash
set -euo pipefail

# $MARKER
should_sync=0

while read -r local_ref local_sha remote_ref remote_sha; do
  if [[ "\$local_ref" == "refs/heads/main" || "\$remote_ref" == "refs/heads/main" ]]; then
    should_sync=1
  fi
done

if [[ "\$should_sync" == "1" ]]; then
  "$ROOT_DIR/scripts/sync_sqlite_to_server.sh"
fi
HOOK

chmod +x "$HOOK_PATH"
echo "Installed pre-push hook for main branch database sync."
