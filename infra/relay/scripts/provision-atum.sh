#!/usr/bin/env bash
# Operator-run provisioning only. Never invoked by the local proof.
set -euo pipefail
relay_dir="$(cd "$(dirname "$0")/.." && pwd)"
cd "$relay_dir"
mode="${1:-}"
if [[ "$mode" != "--apply" && "$mode" != "--plan" && "$mode" != "--verify" ]]; then
  echo 'Usage: provision-atum.sh --plan|--apply|--verify /absolute/path/to/atum-connect.env' >&2
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
export RELAY_DATABASE_PROVIDER="${RELAY_DATABASE_PROVIDER:-external}"
[[ "$RELAY_DATABASE_PROVIDER" = external || "$RELAY_DATABASE_PROVIDER" = planetscale ]] || exit 2
if [[ "$RELAY_DATABASE_PROVIDER" = external ]]; then
  [[ -n "${RELAY_ORIGIN_DATABASE_URL:-}" ]] || { echo 'Missing RELAY_ORIGIN_DATABASE_URL' >&2; exit 2; }
fi
"$node_bin" --input-type=module - "$config_file" <<'JS'
import {statSync} from 'node:fs';
try {
if ((statSync(process.argv[2]).mode & 0o077) !== 0) throw new Error('Environment file must be operator-only (chmod 600)');
for (const name of ['ATUM_CONNECT_ASSERTION_ISSUER','ATUM_CONNECT_ASSERTION_AUDIENCE']) {
 const url = new URL(process.env[name]);
 if (url.protocol !== 'https:' || url.origin !== process.env[name]) throw new Error('Assertion policy must use HTTPS origins');
}
const jwks=JSON.parse(process.env.ATUM_CONNECT_ASSERTION_JWKS);
if (!Array.isArray(jwks.keys) || jwks.keys.length === 0 || jwks.keys.some(k=>k.d || k.kty!=='OKP' || k.crv!=='Ed25519' || !k.x || !k.kid)) throw new Error('Require public-only Ed25519 JWKS');
if (process.env.RELAY_DATABASE_PROVIDER === 'external') {
 const url=new URL(process.env.RELAY_ORIGIN_DATABASE_URL);
 if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.pathname!=='/atum_connect' || decodeURIComponent(url.username)!=='atum_connect' || !url.password || !['require','verify-full'].includes(url.searchParams.get('sslmode'))) throw new Error('Require isolated TLS Postgres URL');
}
} catch { throw new Error('Invalid private relay configuration; check mode 600, public-only JWKS, HTTPS origins and isolated TLS Postgres URL (values redacted)'); }
JS
if [[ "$mode" = --plan ]]; then
  echo "PLAN ONLY (offline, no provider reads): database=$RELAY_DATABASE_PROVIDER; 5-connection Hyperdrive; Worker + native queues/DO; APNs off."
  echo 'Apply requires isolated DB bootstrap + migrations and, for private AWS Postgres, a reviewed VPC service.'
  echo 'No resources, credentials, DNS, migrations or provider state changed.'
  exit 0
fi
if [[ "$mode" = --verify ]]; then
  "$node_bin" --input-type=module <<'JS'
const issuer = process.env.ATUM_CONNECT_ASSERTION_ISSUER;
const response = await fetch(new URL('/api/work/connect/jwks', issuer), {redirect:'error'});
if (!response.ok || JSON.stringify(await response.json()) !== JSON.stringify(JSON.parse(process.env.ATUM_CONNECT_ASSERTION_JWKS))) throw new Error('JWKS mismatch');
const denied = await fetch(new URL('/api/work/connect/assertion', issuer), {method:'POST',headers:{authorization:'Bearer invalid-verification-probe'},redirect:'error'});
if (denied.status !== 401) throw new Error('Unsigned assertion request not refused');
const relay = await fetch(process.env.ATUM_CONNECT_ASSERTION_AUDIENCE, {redirect:'manual'});
if (relay.status >= 500) throw new Error('Relay unavailable');
const metadata = await fetch(new URL('/.well-known/oauth-authorization-server', process.env.ATUM_CONNECT_ASSERTION_AUDIENCE), {redirect:'error'});
if (!metadata.ok || (await metadata.json()).issuer !== process.env.ATUM_CONNECT_ASSERTION_AUDIENCE) throw new Error('Relay metadata unavailable');
const health = await fetch(new URL('/health', process.env.ATUM_CONNECT_ASSERTION_AUDIENCE), {redirect:'error'});
if (!health.ok || (await health.json()).ok !== true) throw new Error('Relay database health unavailable');
console.log('VERIFY_OK public JWKS pinned, anonymous issuer refused, relay reachable; authenticated/off-LAN acceptance remains mandatory');
JS
  exit 0
fi
# External migrations are deliberate: use PG* through an operator-only local tunnel,
# or pipe migrate-external.py --print-sql into the existing AWS database container.
[[ "$RELAY_DATABASE_PROVIDER" != external || "${RELAY_DATABASE_MIGRATED:-}" = true ]] || { echo 'Run isolated relay migrations first; set RELAY_DATABASE_MIGRATED=true only on success' >&2; exit 2; }
# Native stack manages Hyperdrive, Worker, queues,
# state and managed DNS/tunnels. It generates the broker signing key itself.
exec "$relay_dir/scripts/with-deps.sh" "$node_bin" "$relay_dir/../../node_modules/alchemy/bin/cli.js" deploy --config "$relay_dir/alchemy.run.ts" --stage prod --env-file "$config_file" --yes
