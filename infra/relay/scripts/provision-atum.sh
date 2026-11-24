#!/usr/bin/env bash
# Operator-run provisioning only. Never invoked by the local proof.
set -euo pipefail
relay_dir="$(cd "$(dirname "$0")/.." && pwd)"
cd "$relay_dir"
if [[ "${1:-}" != "--apply" ]]; then
  echo 'Usage: provision-atum.sh --apply /absolute/path/to/atum-connect.env' >&2
  exit 2
fi
config_file="${2:?Pass the reviewed dedicated Atum environment file}"
[[ "$config_file" = /* && -f "$config_file" ]] || { echo 'Expected an absolute existing environment file' >&2; exit 2; }
node_bin="${NODE_BIN:-node}"
# The file is operator-owned shell configuration. Do not print it or enable xtrace.
set -a
source "$config_file"
set +a
[[ "${ATUM_CONNECT_ENABLED:-}" = true && "${ATUM_CONNECT_TRIAL:-}" = true && "${APNS_ENABLED:-}" = false ]] || { echo 'Require Atum identity + trial profile; APNs must be disabled' >&2; exit 2; }
[[ -z "${T3CHAT_LINK_SECRET:-}" && -z "${FCM_SERVICE_ACCOUNT:-}" ]] || { echo 'Trial does not enable T3 Chat or push credentials' >&2; exit 2; }
for name in RELAY_API_ZONE_NAME RELAY_TUNNEL_ZONE_NAME ATUM_CONNECT_ASSERTION_ISSUER ATUM_CONNECT_ASSERTION_AUDIENCE ATUM_CONNECT_ASSERTION_JWKS; do
  [[ -n "${!name:-}" ]] || { echo "Missing $name" >&2; exit 2; }
done
# Native stack manages retained Postgres, migrations, Hyperdrive, Worker, queues,
# state and managed DNS/tunnels. It generates the broker signing key itself.
exec "$relay_dir/scripts/with-deps.sh" "$node_bin" "$relay_dir/../../node_modules/alchemy/bin/cli.js" deploy --config "$relay_dir/alchemy.run.ts" --stage prod --env-file "$config_file" --yes
