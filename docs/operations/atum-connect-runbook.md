# Atum Connect private trial

Built and locally verified; not deployed. The coordinator owns integration, distribution and activation. This lane created no cloud resources, DNS records, account or subscription and made no push or CI run. The owner approved a $10–15/month relay budget; this package selects the native Cloudflare option at **$10/month incremental base**, before tax/overages. See [the itemised quote](atum-connect-trial-quote.md).

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

Use the existing Atum platform endpoint `/api/work/connect/assertion`, backed by its verified host-owner authentication, and its public `/api/work/connect/jwks`. That endpoint lives in the platform T1 branch, outside this repository. `createAtumConnectIdentity` calls it with the existing platform bearer, follows no redirects, caches no assertion and discards results if the account switches. Supply `getAssertion()` to the native `ManagedRelay` methods' legacy-named `clerkToken` argument. The native token cache remains partitioned by canonical assertion `sub`, client, relay, scopes and proof key. Normal native DPoP generation, durable replay protection and renewal stay unchanged. Wire this adapter at the account shell's native auth seam; it is a library adapter, not a replacement sign-in UI.

Pin reviewed public Ed25519 JWKS in the relay. Assertions require exact issuer/audience, the `atum-relay-assertion+jwt` type, canonical owner UUID, integer `iat`/`exp`, nonempty `jti`, at most 60-second lifetime and no future `iat`. An invalid Atum assertion never falls back to Clerk. Rotate with overlapping current/previous public keys, then remove the retired key after the assertion window. These are short-lived identity bearers, not agent grants. Never use email or a mutable Matrix name as the principal.

The source default `requireConnectDeviceApproval` is **true**. On an existing Mac explicitly set it true through native server settings before enabling remote access; a decoding default does not overwrite an explicit older false setting. New devices approve once, and native revoke removes their sessions/pending bootstraps. Account-disable fanout and per-agent generation revocation remain separate T3/T4 integration; do not claim logout immediately revokes existing relay/environment sessions.

## One-command provisioning (operator only)

Use a dedicated Atum Cloudflare account/state scope and PlanetScale organization. Keep existing configured origin authoritative. The `prod` Alchemy stage owns retained zones/database; this package must not target T3's account, an existing unrelated relay stack or a shared production DB. No new EC2 instance is needed: native relay fits Workers + Tunnel. Do not run stock deploy with trial settings missing: stock is PS_160 HA.

1. Have both the existing Atum API root zone and delegated managed-endpoint zone active in Cloudflare. This script adopts/references the native zone resources; it does not buy a domain or change registrar nameservers. Check account total tunnels <=1,000 and confirm the private-trial count fits the native allocation cap before activation.
2. Configure the native Alchemy Cloudflare and PlanetScale provider credentials in the intended operator profile, with the permissions required by `infra/relay/README.md` (Worker/state/DO, Hyperdrive, queues, tunnel and DNS management, Postgres/roles). Keep secrets in an operator-only environment file, outside git. This worker did not read any account credentials or provider accounts.
3. Create the platform's dedicated Ed25519 assertion key through its existing secret-management path; set the platform issuer/audience and enable the platform endpoint. Export **only public JWKS** for the relay. Never copy provider logins or plan tokens.
4. Copy the following shape to `/absolute/private/atum-connect.env` (shell assignments; quote JSON), chmod 600, replace the example domains/public key and add provider credential variables documented by native Alchemy. No Clerk, APNs, FCM, T3 Chat or Axiom credentials:

```sh
ATUM_CONNECT_TRIAL=true
ATUM_CONNECT_ENABLED=true
APNS_ENABLED=false
RELAY_API_ZONE_NAME=example.com
RELAY_TUNNEL_ZONE_NAME=connect.example.com
RELAY_DOMAIN=relay.example.com
ATUM_CONNECT_ASSERTION_ISSUER=https://platform.example.com
ATUM_CONNECT_ASSERTION_AUDIENCE=https://relay.example.com
ATUM_CONNECT_ASSERTION_JWKS='{"keys":[{"kty":"OKP","crv":"Ed25519","kid":"current","alg":"EdDSA","use":"sig","x":"REPLACE_PUBLIC_KEY"}]}'
RELAY_TUNNEL_CLEANUP_MODE=off
RELAY_LEGACY_TUNNEL_CLEANUP_MODE=off
```

5. Run the single provisioning entrypoint, with supported Node/npm available:

```sh
NODE_BIN=/opt/homebrew/opt/node@24/bin/node bash infra/relay/scripts/provision-atum.sh --apply /absolute/private/atum-connect.env
```

It validates Atum/trial flags, installs the locked proof/deploy dependencies if necessary, then runs **native Alchemy deploy** at stage `prod`. Native Alchemy creates the retained PS-5 x86 Singapore database (zero replicas), runtime role and ordered migrations; five-connection Hyperdrive pool; Worker placed in Singapore; four push/DLQ queues and SQLite DO/state/maintenance infrastructure. It generates the native broker key. Axiom, source-map bucket/tokens and client telemetry publication are omitted. Managed tunnels/CNAMEs are allocated by the native provider when Macs link, not precreated by the script. Review the native output, then set `T3CODE_RELAY_URL` in the client build/config; trial mode deliberately publishes no client telemetry bundle.

After provision, sign in through Atum, enable native Connect on one Mac, approve one new client and open a real thread/MCP connection off LAN. Measure renewal and revocation, sleep/wake, connector VPN reachability, DB connections and metered usage before increasing the native cap. Cloudflare egress must be reachable; the Mullvad block is still untested. Keep optional tailnet routes.

Rollback: select the previous endpoint for known credentials, disable new Connect admission, revoke the affected device/link through native controls and drain admitted work. Never replay an unknown accepted turn. Retain the database and migration/state history; do not run native destroy as a rollback. Teardown resources only after the coordinator inventories shared DNS/SSH/other consumers.

## Bridge seam

For `feat/native-t3-bridge-a0-1124`, set `BridgeConfig.mcp_url` to the **discovered managed environment origin + `/mcp`**, e.g. `https://prod-<hash>.connect.example.com/mcp`. `managedEnvironmentMcpUrl` creates and validates that value. It has no credentials, query or fragment. Do not use `https://relay.example.com/mcp`: the Worker does not proxy MCP. Hermes' existing `auth: oauth` obtains a dedicated native MCP audience credential directly from the Mac. The bridge's dispatch journal and request identity remain unchanged. Native human Connect DPoP tokens must never be relabeled as S2 agent grants; retain own-thread and agent-generation enforcement for T3. This lane does not edit the bridge branch.
