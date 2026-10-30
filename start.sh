#!/bin/sh
# Start the Reversi Coach Lab local web server on WSL2, macOS, or Linux.
set -eu
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$SCRIPT_DIR"
PYTHON=${REVERSI_PYTHON:-${VIRTUAL_ENV:+$VIRTUAL_ENV/bin/python}}
if [ -z "$PYTHON" ]; then
  if [ -x "$SCRIPT_DIR/.venv/bin/python" ]; then PYTHON="$SCRIPT_DIR/.venv/bin/python"; else PYTHON=python3; fi
fi
if ! command -v "$PYTHON" >/dev/null 2>&1; then
  printf '%s\n' 'Python 3.13+ was not found. Set REVERSI_PYTHON or activate a supported environment.' >&2
  exit 127
fi
exec "$PYTHON" launch.py "$@"
