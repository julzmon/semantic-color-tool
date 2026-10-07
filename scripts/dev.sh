#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# Editor tasks may not load the interactive shell that enables nvm.
task_nvm_dir="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$task_nvm_dir/nvm.sh" ]; then
  . "$task_nvm_dir/nvm.sh" --no-use
  nvm use --silent
fi

if ! command -v node >/dev/null 2>&1 || ! node --version >/dev/null 2>&1; then
  echo 'A working Node.js runtime is required. Install Node 26 or run nvm install in this directory.' >&2
  exit 1
fi
if [ ! -f node_modules/vite/bin/vite.js ]; then
  echo 'Dependencies are missing. Run npm install, then bash scripts/dev.sh.' >&2
  exit 1
fi

exec node node_modules/vite/bin/vite.js --host 127.0.0.1 "$@"
