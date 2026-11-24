#!/usr/bin/env bash
set -euo pipefail
invocation_dir="$PWD"
repo_dir="$(cd "$(dirname "$0")/../../.." && pwd)"
cd "$repo_dir"
node_bin="${NODE_BIN:-node}"
proof_deps="$(mktemp -d /private/tmp/atum-connect-deps-XXXXXX)"
created_link=false
cleanup() {
  if [[ "$created_link" = true ]]; then rm "$repo_dir/node_modules"; fi
  python3 -c 'import shutil,sys; shutil.rmtree(sys.argv[1])' "$proof_deps"
}
trap cleanup EXIT
if [[ ! -e node_modules ]]; then
  cp infra/relay/test-fixtures/package.json "$proof_deps/package.json"
  cp infra/relay/test-fixtures/package-lock.json "$proof_deps/package-lock.json"
  npm ci --prefix "$proof_deps" --ignore-scripts --legacy-peer-deps --no-audit --no-fund
  mkdir -p "$proof_deps/node_modules/@t3tools"
  "$node_bin" infra/relay/test-fixtures/link-deps.mjs "$repo_dir" "$proof_deps"
  ln -s "$proof_deps/node_modules" node_modules
  created_link=true
fi
cd "$invocation_dir"
"$@"
