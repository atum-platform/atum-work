# Atum Connect private trial

Built and locally verified; not deployed. The coordinator owns integration, distribution and activation. This lane created no cloud resources, DNS records, account or subscription and made no push or CI run. The owner approved a $10–15/month relay budget; this package selects the native Cloudflare option at **$5/month incremental base**, before tax/overages. See [the itemised quote](atum-connect-trial-quote.md).

## Adopted implementation

This is the fork's MIT T3 Connect stack, server and shared client runtime, credited in `NOTICE` and `LICENSE`. No new reverse-WebSocket service, VPN, retry supervisor or MCP implementation. The additions are an Atum identity input, a small trial deployment profile and operator/proof scripts. Native `ConnectionDriver` retains learned LAN/tailnet routes and its supervisor owns reconnects. Native managed endpoints carry application/MCP traffic via Cloudflare Tunnel, directly to the Mac; the Worker only brokers identity, linking and discovery.

## Reproduce without cloud resources

Prerequisites: macOS, npm, OpenSSL, Node 24.11.1+ (repository builds normally use Node 26.13.1), and a packaged T3 server. The default is `/Applications/T3 Code (Beta).app`; override `ATUM_T3_EXECUTABLE` with its Electron executable and `ATUM_T3_SERVER` with the packaged `apps/server/dist/bin.mjs`. The proof does not install or modify the app. For a source build, point those variables at the Node executable and built server entrypoint.

From repository root:

```sh
NODE_BIN=/opt/homebrew/opt/node@24/bin/node bash infra/relay/scripts/prove-local.sh
```

On a machine with a supported default Node, omit `NODE_BIN`. The wrapper uses a locked, isolated npm dependency set when the checkout has no `node_modules`; it removes its dependency directory and symlink on exit. It preserves an existing workspace install. Peak source + proof dependencies measured below 1.5 GB. No Docker, Colima, real provider credentials or paid API calls are needed.

The proof starts the **real packaged Mac T3 server**, with disposable state and generated credentials, and the fork's native relay HTTP handlers/EnvironmentLinker/signers. It replaces Cloudflare endpoint provisioning at its external boundary with a disposable TLS loopback forwarding endpoint, and uses in-memory relay persistence. This is a real HTTP/MCP integration test, not evidence of a live Cloudflare tunnel or production SQL connection. Native persistence and managed-provider suites verify those boundaries separately.

The Mac obtains a native relay link challenge, signs its own native link proof, and registers through the native relay API. A synthetic platform signing key produces Atum owner assertions; invalid identity gets 401 and a different owner sees no environments. The discovered Mac rejects Atum account assertions at `/mcp`; the client completes **native external-MCP OAuth + PKCE with one-time Mac approval**, then initializes the real MCP server. The test drops the local tunnel listener, proves a request fails, restores it at the same endpoint, and initializes again with the same valid MCP credential. It prints a JSON `PASS` including the actual Mac version. It never dispatches a provider turn.

The server process is guarded against filesystem reads of the real user's `.codex`, `.claude` and Keychains; provider/security subprocesses are blocked. All state and generated test keys remain under the printed `/private/tmp/atum-connect-proof-*` evidence directory. Stop/cleanup is in `finally`; deleting that disposable directory after inspecting evidence is safe. The proof here used packaged T3 0.1.11; rerun with the assembled T0/Atum package before distribution. No installed-build upgrade or VPN/off-network claim follows from this test.

Focused source checks with a normal workspace install:

```sh
cd infra/relay
../../node_modules/.bin/vp test run --config ../../vite.config.ts src/auth/AtumConnect.loopback.test.ts src/auth/RelayTokens.test.ts src/auth/DpopProofs.verifyAndConsume.test.ts src/http/Api.test.ts src/environments/EnvironmentLinker.test.ts src/environments/EnvironmentConnector.test.ts src/environments/EnvironmentLinks.test.ts
../../node_modules/.bin/tsc --noEmit --project tsconfig.json
```

## Identity and client configuration

Use the existing Atum platform endpoint `/api/work/connect/assertion`, backed by its verified host-owner authentication, and its public `/api/work/connect/jwks`. That endpoint is built-not-live on platform feat/atum-connect-issuer-1124, outside this repository. `createAtumConnectIdentity` calls it with the existing platform bearer, follows no redirects, caches no assertion and discards results if the account switches. Supply `getAssertion()` to the native `ManagedRelay` methods' legacy-named `clerkToken` argument. The native token cache remains partitioned by canonical assertion `sub`, client, relay, scopes and proof key. Normal native DPoP generation, durable replay protection and renewal stay unchanged. Wire this adapter at the account shell's native auth seam; it is a library adapter, not a replacement sign-in UI.

Pin reviewed public Ed25519 JWKS in the relay. Assertions require exact issuer/audience, the `atum-relay-assertion+jwt` type, canonical owner UUID, integer `iat`/`exp`, nonempty `jti`, at most 60-second lifetime and no future `iat`. An invalid Atum assertion never falls back to Clerk. Rotate with overlapping current/previous public keys, then remove the retired key after the assertion window. These are short-lived identity bearers, not agent grants. Never use email or a mutable Matrix name as the principal.

The source default `requireConnectDeviceApproval` is **true**. On an existing Mac explicitly set it true through native server settings before enabling remote access; a decoding default does not overwrite an explicit older false setting. New devices approve once, and native revoke removes their sessions/pending bootstraps. Account-disable fanout and per-agent generation revocation remain separate T3/T4 integration; do not claim logout immediately revokes existing relay/environment sessions.

## Coordinator operator sequence: plan → apply → verify

This worker did not read credentials, connect to production SQL or provision anything.
Migrations ran against a disposable local PostgreSQL 17 instance only. Production
SQL/TLS/private connectivity remain coordinator operations, not completed state.
The default is **external Postgres**; `RELAY_DATABASE_PROVIDER=planetscale` is an
explicit paid-vendor option. Never change database provider on an existing stack
without preserving its data and reviewing the Alchemy diff.

Existing origin inventory: platform `deploy/marketplace/README.md:7` identifies
AWS `i-033b1e0fdc0f605e0` (ap-southeast-1), kit
`/opt/atum/marketplace-kit/current`, runtime `/opt/atum/marketplace-runtime`.
`compose.yaml:12` runs PostgreSQL 17 with no published port and maximum 40
connections. Reserve five for relay; inspect current load first. The relay role
is NOSUPERUSER/NOCREATEDB/NOCREATEROLE/NOREPLICATION/NOBYPASSRLS, database owner
only in `atum_connect`, no shared production schema. Bootstrap SQL is in
`infra/relay/scripts/bootstrap-postgres.sql`; it deliberately fails if the name
already exists. Admins retain their existing instance authority.

**PLAN (no secrets/provider calls):** create a 0600 operator env file outside Git
with the shape below (synthetic values are sufficient for this offline plan).
Cloudflare credentials must come from the coordinator's existing Infisical
profile. The Infisical secret named `CLOUDFLARE_ACCOUNT_ID` is mis-named: it
contains a user API token, not the account ID. Supply that token as
`CLOUDFLARE_ACCOUNT_API_TOKEN` and set `CLOUDFLARE_ACCOUNT_ID` to the literal
Cloudflare account ID from the reviewed account inventory. Never print the token or
source it into a traced shell. Review DNS zone/account ownership and current
usage first; do not create another zone for a subdomain accidentally. Both zone
names may be `atumplatform.com` to reuse the owned active zone; native allocation
will place its environment records there. Domain choice is coordinator-owned.

```sh
ATUM_CONNECT_TRIAL=true
ATUM_CONNECT_ENABLED=true
APNS_ENABLED=false
RELAY_DATABASE_PROVIDER=external
RELAY_ORIGIN_DATABASE_URL='postgresql://atum_connect:REPLACE@PRIVATE_IP/atum_connect?sslmode=require'
RELAY_POSTGRES_VPC_SERVICE_ID=REPLACE_AFTER_PRIVATE_SERVICE_SETUP
RELAY_DATABASE_MIGRATED=false
RELAY_API_ZONE_NAME=atumplatform.com
RELAY_TUNNEL_ZONE_NAME=atumplatform.com
RELAY_DOMAIN=relay.atumplatform.com
ATUM_CONNECT_ASSERTION_ISSUER=https://api.atumplatform.com
ATUM_CONNECT_ASSERTION_AUDIENCE=https://relay.atumplatform.com
ATUM_CONNECT_ASSERTION_JWKS='{"keys":[REPLACE_PUBLIC_JWK]}'
RELAY_TUNNEL_CLEANUP_MODE=off
RELAY_LEGACY_TUNNEL_CLEANUP_MODE=off
```

```bash
# From atum-work root. --plan is an offline operation summary, NOT a cloud diff.
bash infra/relay/scripts/provision-atum.sh --plan /absolute/private/atum-connect.env
```

**APPLY — dependencies in order:**

1. Integrate/deploy the platform issuer using platform
   `docs/operations/atum-connect-issuer.md` (exact key-generation, Infisical,
   Vercel env and AWS linux/amd64 prebuilt commands). Use only its public JWKS
   in the relay file. Neither the platform seed nor a platform session goes there.
2. Before bootstrap, snapshot/backup existing Marketplace using its existing
   runbook. Grant the host IAM role `ssm:PutParameter` only on
   `/atum/prod/connect_db_password` (and the existing KMS key permission), so the
   generated relay password can be escrowed without printing it. This script
   adds a database and enables PostgreSQL TLS by reload; it does not recreate
   the production database container or change Marketplace's non-TLS DSN.
3. Deliver the relay directory using the existing SSM kit mechanism. Write this
   non-secret operator script in the platform checkout as `/absolute/private/connect-db-host.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
bash /opt/atum/src/connect-relay/scripts/prepare-marketplace-postgres.sh --apply
```

```bash
# From platform root; RELAY_SOURCE is the absolute atum-work/infra/relay path.
ATUM_STAGING_INSTANCE=i-033b1e0fdc0f605e0 bash infra/aws/staging/ssm-run.sh \
  /absolute/private/connect-db-host.sh "$RELAY_SOURCE" connect-relay
```

   Inspect `MARKETPLACE_RELAY_DB_READY` and `SSM_STATUS=Success`. Copy the public
   `/opt/atum/connect-postgres/server.crt` via SSM (public certificate only) to
   `/absolute/private/connect-db-ca.pem`. Escrow the new SecureString in Infisical
   `prod:/connect` without terminal output. Fetch it to a private file using the
   existing authenticated operator, then construct the URL with URL-encoded
   password and the printed private IP. Do not put a DSN or password in argv.
4. Reuse the existing Marketplace Cloudflare tunnel that already joins the
   same private Docker network (inspect its ID from the non-secret tunnel
   configuration). Create a VPC TCP service with the **current** database
   container private IP, certificate pin and PostgreSQL protocol. No public port,
   ingress route or DNS record is needed for this origin. Use coordinator CF
   credentials from Infisical, same account as Alchemy. TCP VPC services require
   Wrangler **4.168.0 or newer**; verify the installed version before applying:

```bash
npx wrangler --version
npx wrangler cert upload certificate-authority --ca-cert /absolute/private/connect-db-ca.pem --name atum-connect-db-ca
# Set CERTIFICATE_ID, MARKETPLACE_TUNNEL_ID and DB_PRIVATE_IP to the observed non-secret IDs.
npx wrangler vpc service create atum-connect-postgres --type tcp --tcp-port 5432 \
  --app-protocol postgresql --tunnel-id "$MARKETPLACE_TUNNEL_ID" --ipv4 "$DB_PRIVATE_IP" \
  --certificate-authority "$CERTIFICATE_ID" --cert-verification-mode verify_full
# Record returned service ID as RELAY_POSTGRES_VPC_SERVICE_ID in the private relay env.
# Set RELAY_DATABASE_MIGRATED=true only after the successful host migration receipt.
```

   The pinned native Alchemy Hyperdrive accepts `serviceId`; it does not try to
   dial a Docker IP from the public Internet. TLS is validated by VPC against the
   uploaded CA. Reconcile service IP/certificate after database container
   recreation, and renew the one-year certificate before expiry. Private
   connectivity must be tested before allowing client admission. See
   [Cloudflare's private-origin guide](https://developers.cloudflare.com/hyperdrive/configuration/connect-to-private-database-vpc/).
5. From atum-work root run the final sequence:

```bash
# Only after the successful host receipt, with the public JWKS from deployed Shell:
python3 infra/relay/scripts/configure-external-env.py /absolute/private/atum-connect.env "$DB_PRIVATE_IP" "$VPC_SERVICE_ID" /absolute/private/connect-signing-v1/live-jwks.json
NODE_BIN=/opt/homebrew/opt/node@24/bin/node bash infra/relay/scripts/provision-atum.sh --plan /absolute/private/atum-connect.env
NODE_BIN=/opt/homebrew/opt/node@24/bin/node bash infra/relay/scripts/provision-atum.sh --apply /absolute/private/atum-connect.env
NODE_BIN=/opt/homebrew/opt/node@24/bin/node bash infra/relay/scripts/provision-atum.sh --verify /absolute/private/atum-connect.env
```

Apply runs native Alchemy deploy, including its provider plan, five-connection
Hyperdrive pool, relay Worker, queues, DO/state and broker key. Offline `--plan`
does not claim a provider drift check or prove private reachability. External
migrations are deliberate, separately receipted and never run by Alchemy.
Axiom/APNs/FCM remain off. No PlanetScale credential is required for this default.

**VERIFY:** public JWKS matches the pin, invalid bearer gets 401 and relay origin
is reachable. This HTTP smoke is not database or off-LAN acceptance. Set
`T3CODE_RELAY_URL` in the native client, sign in, enable Connect on one Mac,
approve one client, complete the native DPoP link/discovery flow and open a real
thread/MCP off LAN. Measure renewal, revoke, sleep/wake, SQL connections and
metered use. Mullvad reachability remains untested. Optional tailnet routes stay.

To rerun migrations on the host without recreating the role/key/cert:
`python3 /opt/atum/src/connect-relay/scripts/migrate-external.py --print-sql |
docker exec -i <marketplace-db-container> psql -X -q -U atum_connect -d atum_connect`.
The runner verifies database, role and migration checksums, serializes with an
advisory lock and records each successful migration transaction. Never switch
it to the Marketplace database or run as its application role.

Rollback: disable new Connect admission, select the previous endpoint, revoke
affected devices through native controls, drain accepted work, retain database,
SSM password and state. Do not destroy or regenerate them as rollback.

## Bridge seam

For `feat/native-t3-bridge-a0-1124`, set `BridgeConfig.mcp_url` to the **discovered managed environment origin + `/mcp`**, e.g. `https://prod-<hash>.connect.example.com/mcp`. `managedEnvironmentMcpUrl` creates and validates that value. It has no credentials, query or fragment. Do not use `https://relay.example.com/mcp`: the Worker does not proxy MCP. Hermes' existing `auth: oauth` obtains a dedicated native MCP audience credential directly from the Mac. The bridge's dispatch journal and request identity remain unchanged. Native human Connect DPoP tokens must never be relabeled as S2 agent grants; retain own-thread and agent-generation enforcement for T3. This lane does not edit the bridge branch.
