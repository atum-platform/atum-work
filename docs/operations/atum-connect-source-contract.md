# Atum Connect source contract — 2026-11-24 lane

State: partly built, not live. No push, CI, deployment, resources, account/billing reads, paid API calls or credentials used. Owner authorized T0 and no-spend T1; D2 remains gated on a quote and subsequent coordinator approval. T2–T6 remain open. New-device approval is required at activation, Tailscale retained, Mullvad untested, load balancing deferred.

## Source selection and reconciliation

Fixture base: `feat/work-runtime-0113-1123` at `69a0515771de2ea899fa1d00755aef5917a655c1`; own-thread isolation commit `88d1cf1e29` is an ancestor. Current main is `0b02be3d5f43b8b1e1b2400e7a322e4b0249136d`. Keep the complete runtime branch, including Work/Code presentation, provider credential containment and own-thread handler enforcement. Main is NOT an ancestor: 237 main commits remain to reconcile. Do not describe this lane as main plus 0.1.13 assembled.

`git merge-tree --write-tree HEAD origin/main` (before this lane's commits) found five conflicts: `apps/server/src/orchestration-v2/ProviderSessionManager.ts`, `apps/server/src/project/ProjectService.ts`, `apps/web/src/components/ChatView.tsx`, `apps/web/src/components/chat/ChangedFilesTree.tsx`, `apps/web/src/components/chat/MessagesTimeline.tsx`. No merge was applied. Coordinator must integrate main with the runtime UI owner and rerun the own-thread tests before signing/releasing. Choosing either side wholesale is not acceptable.

Own-thread tests retained unchanged: `apps/server/src/mcp/{McpInvocationContext,linkOrigin}.test.ts` and `apps/server/src/orchestration-v2/ProviderSessionManager.test.ts`. Hidden tools are not authorization. Native environment session authority is broader than S2 agent authority; this slice does not replace the S2 admission gate.

## Actual relay dependencies

- `alchemy.run.ts`: Cloudflare-managed state; Worker custom domain, relay API zone and managed-endpoint zone; Drizzle schema/migrations; PlanetScale; Axiom datasets/tokens and R2 source maps; published client build configuration.
- `src/db.ts`: dedicated PlanetScale **Postgres** database/role, ordered `migrations/postgres` history, Hyperdrive with query cache off and 40 origin connections. Stock PS_160 / us-west / 2 replicas must be replaced for the approved trial; do not run the stock deploy.
- `src/queues.ts`: four queues: APNs delivery + DLQ, FCM delivery + DLQ. Keep push disabled without Atum credentials.
- `src/worker.ts`: Worker placement currently us-west-2, five-minute cleanup cron, HookInboxObject SQLite DO namespace, managed tunnel/DNS credentials and broker signing key. Change placement to Singapore only in the future approved deployment. Webhook holding remains off.
- `src/observability.ts`: Axiom is currently a mandatory deployment dependency, not disabled by this patch. A future no-Axiom trial must remove the exporter/resource dependency and client ingestion publication before deploy. The $0 observability quote assumes that work; the optional existing-stack Axiom alternative costs $25/month before usage.
- `package.json`: Alchemy Cloudflare/Drizzle/PlanetScale/Axiom integrations, Effect SQL-PG/SQLite-DO, Clerk backend, distilled Cloudflare, noble hashes/curves, shared client/contracts packages and Drizzle ORM. No new production dependencies.
- MIT retained in LICENSE and NOTICE; Atum distribution credit is “Based on T3 Code / T3 Connect”. Desktop distribution must carry LICENSES/T3-Code-MIT.txt. Upstream assets/dependency notices still need distribution review.

## Identity contract

Atum mode defaults off. Worker config: `ATUM_CONNECT_ENABLED=true`, `ATUM_CONNECT_ASSERTION_ISSUER`, `ATUM_CONNECT_ASSERTION_AUDIENCE`, `ATUM_CONNECT_ASSERTION_JWKS` (JSON **public** JWKS). Pin public keys from the platform's `/api/work/connect/jwks` through reviewed deployment configuration. Accept overlapping current/previous keys during rotation; remove retired keys after the maximum assertion lifetime. No dynamic token-controlled JWKS fetch. Clerk credentials are not required in this mode; invalid Atum assertions never fall back to Clerk. Existing default Clerk exchange behavior is preserved.

JWT header `alg=EdDSA`, `typ=atum-relay-assertion+jwt`, `kid`; claims `iss` exact platform issuer, `aud` exact relay origin, `sub` canonical lowercase owner UUID, `iat`, `exp<=iat+60`, `jti`. Strict expiry, zero tolerance. This assertion replaces only the identity input. The native DPoP proof consumption, relay access-token issuance, environment linking and environment bootstrap/session exchange are unchanged. No owner/email/handle comes from JSON request parameters. Existing linked-environment ownership checks remain authoritative; expectedOwner is available for verifier fixtures, not a deployment-wide owner pin.

An assertion is a short-lived bearer identity credential; stealing one during its lifetime is not prevented by DPoP. DPoP prevents use of a stolen **issued relay access token** without its proof key. Native new-device approval remains a required independent guard. Account disable cannot instantly revoke existing 30-minute relay tokens or one-hour environment sessions: revocation fanout/renewal cutoff is a live acceptance gate, not claimed here.

## Verification and pending integration

Generated-key Node fixtures cover signature/JWKS, wrong owner/audience/issuer, expiry, excess lifetime, mutable handles, native DPoP key/token binding, platform signing, desktop account switch/default-off and cross-repository signed bytes. Node 23.10 type stripping; no real network requests or private state. See `infra/relay/test-fixtures/*.mjs`.

Focused new-module TypeScript check passed. Full relay API integration/typecheck, durable replay suite `src/auth/DpopProofs.verifyAndConsume.test.ts`, and retained own-thread suites are pending: full workspace installation was intentionally skipped to preserve the concurrent signed-build disk reserve. A tiny isolated harness used pinned Effect 4.1.3, noble 1.9.1/1.8.0, TypeScript 6.0.3 and Node types 24.12.4; its pnpm store is removed after testing. To reproduce standalone Node fixtures, resolve these same packages from relay/shared node_modules, or use a normal workspace installation on a roomy machine.

Next no-spend slice: reconcile main/runtime, wire desktop adapter into native managed authentication and client build relay URL, run full API/replay/own-thread suites and verify no Clerk login is reachable under Atum mode. Then coordinator assembly review. Only after exact spending approval: configure smallest trial resources, exercise one off-network client, new-device approval and measured revocation. T1 cannot be called complete before installed off-network evidence.
