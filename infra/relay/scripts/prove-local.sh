#!/usr/bin/env bash
set -euo pipefail
relay_dir="$(cd "$(dirname "$0")/.." && pwd)"
exec "$relay_dir/scripts/with-deps.sh" "${NODE_BIN:-node}" "$relay_dir/test-fixtures/run-proof.mjs"
