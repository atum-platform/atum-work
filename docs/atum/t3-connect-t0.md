# T0: upstream T3 Connect source contract

State: assembled locally, not released or live. T1 identity adapters, deployment,
installed/off-network acceptance, T2–T6 and account revocation fanout remain open.
No push, PR, CI, credentials, cloud account access, deployment or spend in this lane.

## Source and native adoption

Base: Work runtime 0.1.13, `69a0515771de2ea899fa1d00755aef5917a655c1`.
Merged upstream `pingdotgg/t3code` main at
`2bc7878fff064f9d874bf3d8584f1bd1b20b2879` (596 commits beyond that base,
more than the older plan's estimate of 237). The runtime version is not a Connect
wire version. This merge does not update atum-desktop's runtime pin or release an archive.

The following match upstream byte for byte: `apps/server/src/cli/connect.ts`,
`packages/client-runtime/src/relay/`, `infra/relay/`,
`docs/internals/06_t3-connect.md`, `docs/operations/02_connect-setup.md`.
Upstream renamed the last two from `t3-connect.md` and `connect-setup.md`.
Keep those native names; no duplicate docs or transport implementation.

Read the complete adoption plan on atum-app `origin/docs/t3-connect-adoption-1124`.
Also read fork `origin/feat/t3-connect-t1-1124` at
`16a10db827d034125190d245169f894451a1d473`: reuse its assertion shape,
synthetic-key fixtures, source-contract and trial-quote evidence at T1 assembly.
Do not cherry-pick it into T0: it modifies the relay identity seam and its
cross-repository fixture needs platform/desktop siblings. Its previous full
relay/own-thread verification deferrals are addressed by the checks below.

## Five conflict resolutions

| File                                                         | Resolution                                                                                                                                                                                                                      |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/server/src/orchestration-v2/ProviderSessionManager.ts` | Keep upstream `CommandId` and restart/background-wait support, plus Atum `linkOriginIsFenced`, fail-closed ancestor traversal and credential replacement when tool allowance changes.                                           |
| `apps/server/src/project/ProjectService.ts`                  | Keep upstream `Path`/tracked-folder discovery and Atum repository-aware initial Work/Code choice, with sanitized Git environment.                                                                                               |
| `apps/web/src/components/ChatView.tsx`                       | Use upstream ThreadDetailsPanel props, workspace revision, workspace-mode availability and usage model; wrap that native panel in the existing Work visibility condition. Use upstream `diffAvailable` plus the Work condition. |
| `apps/web/src/components/chat/ChangedFilesTree.tsx`          | Keep all imports and upstream repository grouping/path handling. Preserve Work cards only for ungrouped input; grouped inputs use the native grouped view so repository identities and opening paths are not lost.              |
| `apps/web/src/components/chat/MessagesTimeline.tsx`          | Keep the Work loading skeleton within upstream's loading container; drop the old redundant background styling.                                                                                                                  |

Additional compatibility fix: the Atum Work visibility invariant now tests native
`linked-thread` instead of the retired `side-chat` right-panel discriminant.

Redundancy decisions: upstream owns the panel props/revision invalidation,
repository grouping, diff availability, linked-thread surface and loading
container styling. No parallel Atum replacement for these is introduced. No
whole Atum capability patch became redundant: upstream still lacks our
own-thread allow-list/handler enforcement and configured `ask_my_agent` bridge.
Native user-question/toolkit paths, Atum theme hooks, protected connector traffic,
Work/Code presentation and provider-sign-in patches remain. In particular,
peer-link mutation fencing alone is not own-thread read isolation.

## Auth and endpoint versions

Contracts: `packages/contracts/src/relay.ts` (OpenAPI version `1.0.0`, near line
1338), `auth.ts`, `environmentHttp.ts`; cryptography tags in
`packages/shared/src/relayJwt.ts:11` and `infra/relay/src/auth/RelayTokens.ts:21`.
There is no new Atum wire protocol in T0.

- Relay discovery/link/challenge/recovery/connect/status APIs use `/v1`.
  Devices have frozen iOS-only `/v1/client/devices` and cross-platform
  `/v2/client/devices`; preserve both.
- `/v1/client/dpop-token` takes form-encoded RFC 8693 token exchange with
  JWT subject-token type, exact relay `resource`, scopes and public client ID
  `t3-web` or `t3-mobile` (`relay.ts:758–785,1160`). Input currently is Clerk.
- Relay access tokens are `t3-relay-dpop-access+jwt`, 30 minutes, `cnf.jkt`;
  permitted scopes are `environment:connect`, `environment:status`, and mobile
  registration where allowed. Link challenge type is `t3-link-challenge+jwt`.
- Broker/environment signatures use EdDSA and distinct typed JWTs, including
  `t3-env-link+jwt`, `t3-cloud-mint+jwt`, `t3-env-mint+jwt`; nonce/request/key
  binding and durable proof replay consumption stay native.
- Environment bootstrap is one use, bound to the client's proof key, normally
  two minutes or ten while waiting for new-device approval
  (`EnvironmentAuth.ts:1279`). Exchange at environment `/oauth/token` produces
  a one-hour renewable DPoP session, not a relay-issued environment token.
  `/api/auth/session` and websocket tickets stay environment-local
  (`environmentHttp.ts:597–626`). Auth access-stream events use `version: 1`
  (`auth.ts:414`), separate from relay endpoint versioning.

## D1: exact identity seam, for T1

Replace the verified account identity input, not DPoP, environment authorization,
link signatures, tunnel allocation, reconnection or session renewal.

1. `infra/relay/src/http/Api.ts:1693` `verifyClerkBearerToken` uses Clerk
   `verifyToken` and audience. At `:1061`,
   `layerTokenApi`'s `exchangeDpopAccessToken` handler calls it
   directly before consuming the native proof and issuing a relay token. This
   must accept a verified Atum assertion and derive canonical owner ID from its
   signed subject. Never derive the owner from request JSON/email/Matrix handle.
2. `Api.ts:1737` `verifyRelayClientBearerToken` and `:1711`
   `verifyClerkOAuthBearerToken` feed `layerClientAuth`'s `clientBearer` at `:318`.
   Adapt this path too: list/link/challenge use bearer identity without the
   DPoP-token exchange. Changing only exchange leaves a Clerk-only linking path.
3. `infra/relay/src/worker.ts:171–173` currently requires Clerk secret,
   publishable key and audience, injected at `:243–245`; `src/Config.ts`
   defines the service shape. Atum mode needs issuer/audience/public JWKS
   configuration with no invalid-assertion fallback to Clerk.
4. Client supply seams: `ManagedRelay`'s `clerkToken` inputs and
   `bearerHeaders`/token-exchange body in
   `packages/client-runtime/src/relay/managedRelay.ts:536,630–649`;
   `apps/web/src/cloud/useCloudLinkController.ts:57,153` obtains Clerk tokens.
   CLI uses `CliTokenManager` and `cloud/publicConfig.ts:176–207` for Clerk
   OAuth/PKCE/device-grant metadata. Adapt the account/storage entry points at
   T1; preserve native OAuth state/PKCE and managed connection lifecycle.

Reuse the earlier T1 verifier/fixtures: EdDSA, `typ=atum-relay-assertion+jwt`,
`kid`, exact issuer and relay audience, canonical owner UUID `sub`, `iat`,
`exp <= iat + 60`, `jti`, public pinned rotating JWKS. The platform signing
endpoint and desktop account-switch adapter from that lane need coordinated
integration. A stolen short-lived assertion remains a bearer identity risk;
DPoP protects the issued relay token, not the assertion. Require native new-device
approval on activation (D5). Atum account disable must fan out revocation and
stop renewal; token TTL alone does not provide immediate cutoff. Human sessions
are broader than S2 grants: retain S2 admission/own-thread authorization.

## Relay dependency and licence inventory

`infra/relay/package.json` and pinned workspace catalog, verified against installed
manifests:

| Direct production dependency                                     | Version          | Licence        |
| ---------------------------------------------------------------- | ---------------- | -------------- |
| `@alchemy.run/{axiom,cloudflare,drizzle,planetscale}`, `alchemy` | 2.0.0-beta.85    | Apache-2.0     |
| `@clerk/backend`                                                 | 3.27.0           | MIT            |
| `@distilled.cloud/cloudflare`                                    | 1.0.0-rc.18      | Apache-2.0     |
| `effect`, `@effect/{sql-pg,sql-sqlite-do}`                       | 4.1.5            | MIT            |
| `@noble/curves`, `@noble/hashes`                                 | 1.9.1, 1.8.0     | MIT            |
| `drizzle-orm`                                                    | 1.0.0-rc.5       | Apache-2.0     |
| `@t3tools/{client-runtime,contracts,shared}`                     | workspace source | repository MIT |

The companion [installed dependency inventory](t3-connect-relay-dependencies.json)
records 287 production-graph package/version/manifest-licence entries, no
unresolved dependencies. It deliberately includes workspace dependencies' broad
source graph, excludes dev/optional dependencies, and is not a claim that every
entry ships in the tree-shaken Worker. Licence declarations include MIT,
Apache-2.0, BSD, ISC, Unlicense, MIT/Zlib; choose MIT for dual MIT/GPL JSZip.
Workspace manifests without a licence field inherit the repository MIT notice.
`@cursor/sdk` declares `SEE LICENSE IN LICENSE.md`; the installed text is
© Anysphere Inc., all rights reserved, subject to Cursor Terms of Service.
This provider SDK enters through the broad shared workspace graph; distribution
requires its vendor licence review if bundled. Do not label the whole graph MIT or treat
this manifest inventory as a completed bundled-artifact licence audit.

Preserve `LICENSE` (Copyright 2026 T3 Tools Inc.) in source and distributed
notices, Apache notices where supplied, dependency licence texts and existing
asset notices. Atum credit: “Based on T3 Code / T3 Connect”. MIT grants no T3
trademark endorsement. No new production dependency in this merge resolution.

## Deployment requirements and small-scale estimate

This is a Cloudflare Worker control plane, not a VPS relay or a D1-only service.
Normal thread traffic travels through native cloudflared/Tunnel, not the Worker.

- `infra/relay/alchemy.run.ts:19–60`: Alchemy with Cloudflare state, Worker custom
  API domain, managed-endpoint DNS zone, client config publication.
- `src/db.ts:38–84`: dedicated **Postgres**, ordered Drizzle migration history,
  runtime role and Hyperdrive (query cache off, 40 origin connections currently).
  Stock retained PS_160/us-west/two replicas is not the private trial sizing.
- `src/worker.ts`: SQLite `HookInboxObject` Durable Object namespace, five-minute
  cron, APNs/FCM queues and dead-letter queues. Push providers need Atum's own
  credentials; leave push and optional offline webhook holding off initially.
  No direct relay Workers KV namespace is declared; durable replay state is in
  Postgres, not KV. Alchemy's state backend has its own Worker/DO prerequisites.
- Cloudflare tunnel/DNS permissions, broker signing key, public environment keys,
  own zones/domains and connector recovery registration. Native allocation caps
  and idle-tunnel recovery stay intact. No customer Cloudflare/VPN setup.
- Stock observability is a hard Axiom deployment dependency with R2 source maps
  (`src/observability.ts`, `alchemy.run.ts`). A $0 observability trial requires
  deliberately removing those resource/exporter/publication dependencies at T1;
  simply disabling client telemetry does not remove the deployment cost.

Public pricing checked 2026-11-23: [Workers Paid](https://developers.cloudflare.com/workers/platform/pricing/)
starts at $5/account/month and includes usage allowances for Workers, Hyperdrive
and DOs. [PlanetScale single-node Postgres](https://planetscale.com/changelog/single-node)
starts at $5/month. [Tunnel capacity](https://developers.cloudflare.com/tunnel/features/tunnels-for-platforms/)
includes 1,000/account; additional capacity is $4.50/tunnel/month, idle tunnels
count. No account quota was inspected.

Planning estimate for two Macs (ceiling ten), <=100k monthly control requests,
low DB/DO usage, existing DNS/platform auth, no push/held hooks and no paid
observability: **$10/month baseline, budget $10–15/month** before tax/domain and
usage overages. This adopts the earlier T1 Singapore PS-5 non-HA quote rather
than the stock HA size; verify pinned Alchemy SKU support, pool limits, regional
quote and actual account headroom before provisioning. The stock Axiom/PS_160
stack is explicitly outside that estimate; optional Axiom's earlier quote adds
$25/month before usage. No resources were provisioned. Approval and spend remain
with the coordinator. Tailscale remains optional (D3); no load balancer (D7).

## Verification and handoff

Installed with pnpm 12.14.0, frozen lockfile, scripts disabled, filtered to server,
web, client-runtime, relay and their workspace dependencies, then scripts/lint
plugin dependencies. Local `pnpm exec vp` 1.4.0 was available; no global `vp`.
No prepared Git hook was installed (install scripts were disabled); focused
format/lint/typecheck/tests were run manually. No hook bypass is needed.
Node 24.21.0 was used for SQLite-backed tests; the ambient Node 23.10.0 lacks
required `node:sqlite` APIs. Source checkout uses sparse exclusion of read-only
`.repos` references to stay within the 3 GiB footprint cap (observed peak rounded
3.0 GiB before exclusion, 2.9 GiB afterwards). All node_modules are removed at
handoff; source/commits remain.

All commands below use the owning package cwd unless explicitly at root:

| Check                                                                                                                                                                                                                           | Result / exit code               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Server `effect-tsgo tsrs --noEmit`                                                                                                                                                                                              | 0                                |
| Web `effect-tsgo tsrs --noEmit`                                                                                                                                                                                                 | 0                                |
| Client-runtime `effect-tsgo tsrs --noEmit`                                                                                                                                                                                      | 0                                |
| Relay `effect-tsgo tsrs --noEmit`                                                                                                                                                                                               | 0                                |
| Server `vp test run src/mcp/McpInvocationContext.test.ts src/mcp/linkOrigin.test.ts src/mcp/McpHttpServer.test.ts src/orchestration-v2/ProviderSessionManager.test.ts src/project/ProjectService.test.ts src/mcp/toolkits/atum` | 7 files, 156 tests passed; 0     |
| Server native CLI Connect/up tests                                                                                                                                                                                              | 2 files, 14 tests passed; 0      |
| Explicit direct denial `vp test run src/mcp/McpHttpServer.test.ts -t 'a credential with a tool allow-list'`                                                                                                                     | 1 passed, 44 filtered/skipped; 0 |
| Client-runtime `vp test run src/relay src/connection`                                                                                                                                                                           | 17 files, 259 tests passed; 0    |
| Relay `vp test run --config ../../vite.config.ts --dir .`                                                                                                                                                                       | 37 files, 318 tests passed; 0    |
| Web `vp test run --project unit` with Atum Work mode, icon imports, submit access, provider sign-in and keybindings files                                                                                                       | 5 files, 69 tests passed; 0      |
| Web timeline logic and active-tools tests (`--project unit`)                                                                                                                                                                    | 2 files, 127 tests passed; 0     |
| Root `vp lint` on five resolved files and Work mode test                                                                                                                                                                        | 0                                |
| Root `vp fmt --check` on those files and `docs/atum`                                                                                                                                                                            | 0                                |
| `git diff --check` and exact upstream comparison of protected Connect paths                                                                                                                                                     | 0                                |

Initial failed attempts are not green evidence: root `vp test` discovery loaded
uninstalled mobile dependencies (exit 1); Node 23 SQLite tests failed (exit 1);
server typecheck lacked scripts workspace links (exit 1); web typecheck caught
the retired `side-chat` test value (exit 1); lint initially lacked its plugin
workspace dependency (exit 1). Each cause was fixed in the setup/source before
the successful focused checks. An offline scripts install failed because its
store tarballs were absent; the subsequent frozen online install passed.
Existing Effect brand suggestions are advisory, not type errors. Full base-to-merge
`git diff --cached --check` reports upstream trailing whitespace in read-only
`.repos` changelogs and patch payloads (exit 2); these upstream bytes are retained.
The resolution diff against upstream is clean.

No real provider turn, account, network acceptance or installed build is claimed.
Coordinator next steps: review the assembled merge once, adopt its SHA in runtime
release work, integrate the existing T1 adapters/fixtures against this contract,
then prepare the exact no-apply resource plan before authorized activation.
