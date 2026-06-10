#!/usr/bin/env python3
"""Watch the local SQLite database and sync it to the server after changes."""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
import time
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parents[1]
DEFAULT_DB = ROOT_DIR / "db" / "mail.sqlite"
DEFAULT_SYNC_SCRIPT = ROOT_DIR / "scripts" / "sync_sqlite_to_server.sh"


def watched_paths(db_path: Path) -> list[Path]:
    return [
        db_path,
        db_path.with_name(db_path.name + "-wal"),
        db_path.with_name(db_path.name + "-shm"),
    ]


def current_signature(paths: list[Path]) -> tuple[tuple[str, int, int], ...]:
    signature: list[tuple[str, int, int]] = []
    for path in paths:
        try:
            stat = path.stat()
        except FileNotFoundError:
            signature.append((str(path), 0, 0))
            continue
        signature.append((str(path), stat.st_mtime_ns, stat.st_size))
    return tuple(signature)


def run_sync(sync_script: Path) -> bool:
    print(time.strftime("[%Y-%m-%d %H:%M:%S]"), "sync started", flush=True)
    result = subprocess.run([str(sync_script)], cwd=str(ROOT_DIR), check=False)
    if result.returncode == 0:
        print(time.strftime("[%Y-%m-%d %H:%M:%S]"), "sync finished", flush=True)
        return True

    print(
        time.strftime("[%Y-%m-%d %H:%M:%S]"),
        f"sync failed with exit code {result.returncode}",
        file=sys.stderr,
        flush=True,
    )
    return False


def main() -> int:
    parser = argparse.ArgumentParser(description="Watch local SQLite changes and sync to Aliyun.")
    parser.add_argument("--db", default=str(DEFAULT_DB), help="Local SQLite database path.")
    parser.add_argument("--sync-script", default=str(DEFAULT_SYNC_SCRIPT), help="Sync script path.")
    parser.add_argument("--interval", type=float, default=3.0, help="Polling interval in seconds.")
    parser.add_argument("--debounce", type=float, default=8.0, help="Wait time after the last change.")
    parser.add_argument("--sync-on-start", action="store_true", help="Run a sync when the watcher starts.")
    args = parser.parse_args()

    db_path = Path(args.db)
    if not db_path.is_absolute():
        db_path = ROOT_DIR / db_path

    sync_script = Path(args.sync_script)
    if not sync_script.is_absolute():
        sync_script = ROOT_DIR / sync_script

    if not db_path.exists():
        print(f"Database not found: {db_path}", file=sys.stderr)
        return 1

    if not sync_script.exists():
        print(f"Sync script not found: {sync_script}", file=sys.stderr)
        return 1

    paths = watched_paths(db_path)
    last_signature = current_signature(paths)
    pending_since: float | None = None
    last_change_at: float | None = None

    print(f"Watching {db_path}", flush=True)
    print("Press Ctrl+C to stop.", flush=True)

    if args.sync_on_start:
        run_sync(sync_script)
        last_signature = current_signature(paths)

    try:
        while True:
            time.sleep(max(args.interval, 0.5))
            signature = current_signature(paths)
            now = time.time()

            if signature != last_signature:
                last_signature = signature
                last_change_at = now
                if pending_since is None:
                    pending_since = now
                continue

            if pending_since is not None and last_change_at is not None:
                if now - last_change_at >= max(args.debounce, 1.0):
                    run_sync(sync_script)
                    pending_since = None
                    last_change_at = None
                    last_signature = current_signature(paths)
    except KeyboardInterrupt:
        print("\nWatcher stopped.", flush=True)
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
