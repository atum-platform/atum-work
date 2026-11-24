#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "$0")/../.." && pwd)
node_bin=${WORK_NODE:-/opt/homebrew/opt/node@24/bin/node}
python_bin=${HERMES_PROOF_PYTHON:?Set HERMES_PROOF_PYTHON to the disposable Hermes/Synapse interpreter}
proof=${HERMES_PROOF_ROOT:?Set HERMES_PROOF_ROOT to the cloud lane checkout}
output=${NATIVE_MAC_EVIDENCE:-/private/tmp/native-mac-accept}
mkdir -p "$output"
cd "$root"
ATUM_WORK_MAC_ID=mac "$node_bin" --test apps/server/src/mcp/toolkits/atum/*.test.mjs > "$output/toolkit.log" 2>&1
WORK_NODE="$node_bin" python3 scripts/native-t3-bridge-mac/start_smoke.py > "$output/startup.log" 2>&1
WORK_NODE="$node_bin" python3 scripts/native-t3-bridge-mac/two_macs.py > "$output/two-macs.log" 2>&1
WORK_NODE="$node_bin" python3 scripts/native-t3-bridge-mac/ordinary_clients.py > "$output/outside-clients.log" 2>&1
PYTHONDONTWRITEBYTECODE=1 "$python_bin" "$proof/scripts/native-t3-bridge/prove_chat.py" \
  --synapse-python "$python_bin" --work "$root" --evidence "$output/chat.json" > "$output/chat.log" 2>&1
PYTHONDONTWRITEBYTECODE=1 "$python_bin" "$proof/scripts/native-t3-bridge/power_spike.py" \
  --work "$root" --node "$node_bin" --faults --evidence "$output/faults.json" > "$output/faults.log" 2>&1
echo "PASS native Mac toolkit, real Work startup, real Hermes/Matrix chat and transport faults: $output"
