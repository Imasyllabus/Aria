# Sift

A small, standalone tool that triages your inbox: it pulls mail from **Gmail and/or Outlook**, classifies each message (importance + category), and optionally acts on it — labeling, flagging VIPs, archiving noise, and sending junk to Trash.

It's deliberately self-contained and portable: a single Python package with a `sift` CLI and a `sift watch` background service. No server, no database — state is a small JSON file. Run it on a laptop, a VPS, or a cron box.

> Safety first: every action is **dry-run by default**. Nothing changes in your mailbox until you pass `--apply`, and even then junk is moved to **Trash, never permanently deleted** (permanent delete requires the explicit, separate `--purge` flag).

## How it classifies

A **hybrid** classifier:

1. **Rules** handle the obvious cases instantly and for free (VIP senders, bulk/`List-Unsubscribe` mail, receipts, calendar invites, etc.).
2. **Claude** is consulted only for the ambiguous remainder, and only when you pass `--ai` (needs `ANTHROPIC_API_KEY`). Ambiguous emails are batched into few requests with a cached taxonomy prompt to keep cost low.

Rules-only mode needs no API key and no network beyond your mail provider.

## Install

```bash
git clone <this-repo>
cd <this-repo>
pip install -e .          # installs the `sift` command
```

Requires Python 3.10+.

## Configure

Copy `.env.example` to `.env` and fill it in (the CLI auto-loads `.env`), or export the variables yourself.

| Variable | Purpose | Default |
|---|---|---|
| `SIFT_PROVIDERS` | `gmail`, `outlook`, or `gmail,outlook` | `gmail,outlook` |
| `SIFT_VIP_SENDERS` | Always-top-priority senders/domains (CSV) | – |
| `SIFT_CONFIDENCE_THRESHOLD` | Below this rule-confidence, escalate to AI | `0.6` |
| `SIFT_WATCH_INTERVAL` | Seconds between `watch` cycles | `300` |
| `SIFT_STATE_FILE` | Where `watch` remembers processed mail | `sift_state.json` |
| `ANTHROPIC_API_KEY` | Needed only for `--ai` | – |
| `SIFT_AI_MODEL` | Override classifier model | `claude-opus-4-7` |

**Gmail:** download an OAuth *Desktop* client from Google Cloud Console → Credentials, save it as `credentials.json`. First run opens a browser to authorize; the token is cached locally.

**Outlook / Microsoft 365:** register a public client app in Azure, set `OUTLOOK_CLIENT_ID`. First run uses an interactive sign-in; the token is cached locally.

## Use

```bash
# Preview only — see what Sift would do, change nothing:
sift run

# Preview with AI on the ambiguous cases:
sift run --ai

# Actually apply: label, flag VIPs, archive noise, junk -> Trash:
sift run --apply

# Just one mailbox, only unread, machine-readable output:
sift run --provider gmail --unread-only --json
```

### Background service

`sift watch` runs the triage on a loop and remembers what it has already handled (so restarts don't re-classify — or re-bill — old mail).

```bash
# Auto-sort unread mail every 5 minutes (applies changes; never permanently deletes):
sift watch --apply --ai --interval 300

# One cycle and exit — ideal for cron / systemd timers:
sift watch --apply --once
```

The watcher can never permanently delete: there is intentionally no `--purge` here.

## Develop / test

```bash
pip install -e ".[dev]"
pytest -q
```

## Status

Standalone and personal for now. It's built so it can later be embedded into a larger assistant, but it has no dependency on any other project.
