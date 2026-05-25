#!/usr/bin/env bash
# One-shot Sift setup for Android / Termux.
#
# Usage (from inside the cloned repo):
#   bash scripts/termux-setup.sh
#
# Installs Python + build deps, installs Sift, then connects Gmail if a
# credentials.json (your Google OAuth "Desktop" client) is present.
set -euo pipefail

echo "==> Installing system packages (python, git, and build deps for cryptography)..."
pkg install -y python git rust binutils openssl libffi clang make

echo "==> Granting Termux access to shared storage (approve the Android prompt if it appears)..."
termux-setup-storage || true

echo "==> Upgrading pip and installing Sift..."
python -m pip install --upgrade pip wheel
pip install -e .

echo
if [ -f credentials.json ]; then
  echo "==> Found credentials.json — connecting to Gmail."
  echo "    A URL will be printed: open it, pick your account, tap Allow."
  export SIFT_PROVIDERS="${SIFT_PROVIDERS:-gmail}"
  sift auth
else
  cat <<'MSG'
==> Sift is installed, but credentials.json is not here yet.

   1. In your phone browser, create a Gmail OAuth *Desktop* client and download
      the JSON (steps are in the chat).
   2. Move it into this folder as credentials.json, e.g.:
        cp ~/storage/downloads/client_secret_*.json ./credentials.json
   3. Then run:
        SIFT_PROVIDERS=gmail sift auth
MSG
fi
