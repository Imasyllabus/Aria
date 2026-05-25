"""Command-line entry point for Sift."""

from __future__ import annotations

import argparse
import logging
import sys

from . import __version__
from .config import Config
from .models import Provider
from .pipeline import RunOptions, run
from .report import render_json, render_text


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="sift",
        description="Triage Gmail + Outlook: classify, prioritize, categorize, clean up.",
    )
    parser.add_argument("--version", action="version", version=f"sift {__version__}")
    sub = parser.add_subparsers(dest="command", required=True)

    r = sub.add_parser("run", help="Fetch, classify, and (optionally) act on mail.")
    r.add_argument(
        "--provider", choices=["gmail", "outlook", "both"], default=None,
        help="Which mailbox(es) to read (default: from SIFT_PROVIDERS).",
    )
    r.add_argument("--max", type=int, default=None, help="Max messages per mailbox.")
    r.add_argument("--unread-only", action="store_true", help="Only unread messages.")
    r.add_argument("--query", default=None, help="Provider-native search query.")

    ai_group = r.add_mutually_exclusive_group()
    ai_group.add_argument("--ai", dest="ai", action="store_true",
                          help="Escalate ambiguous emails to Claude (needs ANTHROPIC_API_KEY).")
    ai_group.add_argument("--no-ai", dest="ai", action="store_false", help="Rules only (default).")
    r.set_defaults(ai=False)

    r.add_argument("--apply", action="store_true",
                   help="Apply changes (labels, flag, archive, junk->Trash). Default is dry-run.")
    r.add_argument("--purge", action="store_true",
                   help="With --apply, permanently delete junk instead of trashing. NOT reversible.")
    r.add_argument("--confidence", type=float, default=None,
                   help="Override the rule-confidence threshold for AI escalation.")
    r.add_argument("--model", default=None, help="Override the Claude model id.")
    r.add_argument("--json", action="store_true", help="Emit JSON instead of a text report.")
    r.add_argument("-v", "--verbose", action="store_true", help="Verbose logging.")

    w = sub.add_parser("watch", help="Run continuously, auto-sorting new mail on an interval.")
    w.add_argument("--provider", choices=["gmail", "outlook", "both"], default=None)
    w.add_argument("--max", type=int, default=None, help="Max messages per mailbox per cycle.")
    w.add_argument("--interval", type=int, default=None, help="Seconds between cycles.")
    w.add_argument("--once", action="store_true", help="Run a single cycle and exit (for cron).")
    w.add_argument("--unread-only", action="store_true", default=True,
                   help="Only consider unread mail (default for watch).")
    w.add_argument("--all", dest="unread_only", action="store_false",
                   help="Consider all inbox mail, not just unread.")
    ai_w = w.add_mutually_exclusive_group()
    ai_w.add_argument("--ai", dest="ai", action="store_true",
                      help="Escalate ambiguous emails to Claude (needs ANTHROPIC_API_KEY).")
    ai_w.add_argument("--no-ai", dest="ai", action="store_false")
    w.set_defaults(ai=False)
    w.add_argument("--apply", action="store_true",
                   help="Apply changes each cycle (labels, flag, archive, junk->Trash). "
                        "Without it the service only reports. Never permanently deletes.")
    w.add_argument("--confidence", type=float, default=None)
    w.add_argument("--model", default=None, help="Override the Claude model id.")
    w.add_argument("-v", "--verbose", action="store_true", help="Verbose logging.")
    return parser


def _resolve_providers(value: str | None, config: Config) -> list[Provider] | None:
    if value is None:
        return None
    if value == "both":
        return [Provider.GMAIL, Provider.OUTLOOK]
    return [Provider(value)]


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    logging.basicConfig(
        level=logging.INFO if getattr(args, "verbose", False) else logging.WARNING,
        format="%(levelname)s %(name)s: %(message)s",
    )

    config = Config.from_env()
    if args.confidence is not None:
        config.confidence_threshold = args.confidence
    if args.model is not None:
        config.ai.model = args.model

    if args.ai and not config.ai.api_key:
        print("--ai requires ANTHROPIC_API_KEY to be set.", file=sys.stderr)
        return 2

    if args.command == "watch":
        return _cmd_watch(args, config)
    if args.command == "run":
        return _cmd_run(args, config)
    return 1


def _cmd_run(args, config: Config) -> int:
    if args.purge and not args.apply:
        print("--purge requires --apply (and permanently deletes junk).", file=sys.stderr)
        return 2

    options = RunOptions(
        providers=_resolve_providers(args.provider, config),
        max_results=args.max,
        unread_only=args.unread_only,
        query=args.query,
        use_ai=args.ai,
        dry_run=not args.apply,
        purge=args.purge,
    )

    try:
        result = run(config, options)
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    if args.json:
        print(render_json(result))
    else:
        print(render_text(result, dry_run=options.dry_run, purge=options.purge))

    # Non-zero exit if every configured provider failed to fetch.
    if result.fetch_errors and not result.classified:
        return 1
    return 0


def _cmd_watch(args, config: Config) -> int:
    from .watch import watch

    options = RunOptions(
        providers=_resolve_providers(args.provider, config),
        max_results=args.max,
        unread_only=args.unread_only,
        use_ai=args.ai,
        dry_run=not args.apply,
        purge=False,
    )
    return watch(config, options, interval=args.interval, once=args.once)


if __name__ == "__main__":
    raise SystemExit(main())
