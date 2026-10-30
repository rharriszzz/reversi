#!/bin/sh
# Explicit developer-only installation. Never run during application startup.
set -eu
sdk_dir="${REVERSI_EMSDK:-$HOME/.local/share/reversi-emsdk}"
if [ ! -d "$sdk_dir/.git" ]; then
  git clone --depth 1 --branch 4.0.22 https://github.com/emscripten-core/emsdk.git "$sdk_dir"
fi
"$sdk_dir/emsdk" install 4.0.22
"$sdk_dir/emsdk" activate 4.0.22
printf 'Build with: REVERSI_EMSDK="%s" node scripts/wasm/build.mjs\n' "$sdk_dir"
