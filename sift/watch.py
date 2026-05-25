"""Background service: poll mailboxes on an interval and auto-sort new mail.

Continuously runs the triage pipeline. State (the keys of already-processed
messages) is persisted to a JSON file so a restart doesn't re-classify — and,
when --ai is on, doesn't re-pay for — mail it has already handled.

By design this mode NEVER permanently deletes: junk goes to Trash only. There
is deliberately no --purge here.
"""

from __future__ import annotations

import json
import logging
import os
import time
from collections import Counter
from datetime import datetime

from .config import Config
from .pipeline import RunOptions, RunResult, email_key, run

logger = logging.getLogger("sift.watch")


def load_state(path: str) -> set[str]:
    if not os.path.exists(path):
        return set()
    try:
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
        return set(data.get("processed", []))
    except (json.JSONDecodeError, OSError):
        logger.warning("Could not read state file %s; starting fresh.", path)
        return set()


def save_state(path: str, processed: set[str], cap: int = 5000) -> None:
    # Keep the file bounded; we only need recent IDs to avoid reprocessing.
    trimmed = list(processed)[-cap:]
    tmp = f"{path}.tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump({"processed": trimmed}, fh)
    os.replace(tmp, path)


def _cycle_summary(result: RunResult, dry_run: bool) -> str:
    stamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    if not result.classified and not result.fetch_errors:
        return f"[{stamp}] no new mail."
    counts = Counter(i.classification.importance.value for i in result.classified)
    applied = sum(1 for a in result.actions if a.applied)
    bits = ", ".join(f"{k}={v}" for k, v in counts.most_common()) or "none"
    mode = "dry-run" if dry_run else "applied"
    line = f"[{stamp}] {len(result.classified)} new ({bits}); actions {mode}: {applied}."
    if result.fetch_errors:
        line += " errors: " + ", ".join(result.fetch_errors)
    return line


def watch(
    config: Config,
    options: RunOptions,
    interval: int | None = None,
    once: bool = False,
    state_file: str | None = None,
) -> int:
    interval = interval if interval is not None else config.watch_interval
    state_path = state_file or config.state_file
    options.purge = False  # hard guarantee: the service never permanently deletes
    processed = load_state(state_path)

    if not once:
        logger.info("Watching every %ss (state: %s). Ctrl-C to stop.", interval, state_path)

    try:
        while True:
            options.skip_ids = processed
            try:
                result = run(config, options)
                for item in result.classified:
                    processed.add(email_key(item.email))
                save_state(state_path, processed)
                print(_cycle_summary(result, options.dry_run), flush=True)
            except Exception as exc:  # keep the daemon alive across transient failures
                logger.error("Cycle failed: %s", exc)
                print(f"[{datetime.now():%Y-%m-%d %H:%M:%S}] cycle error: {exc}", flush=True)

            if once:
                break
            time.sleep(interval)
    except KeyboardInterrupt:
        print("\nStopped.", flush=True)
    return 0
