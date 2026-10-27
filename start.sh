#!/bin/sh
# Start the Reversi Coach Lab local web server on WSL2, macOS, or Linux.
set -eu
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$SCRIPT_DIR"
if ! command -v python3 >/dev/null 2>&1; then
  printf '%s\n' 'Python 3 was not found. Install Python 3 and try again.' >&2
  exit 127
fi
exec python3 launch.py "$@"
