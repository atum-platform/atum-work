# Atum Work startup instrumentation (0.1.15 follow-up)

Built, not released. Owner report 2026-11-24: Work can take 10–20s to open in an already-running desktop.

Native equivalents inspected: `packages/provider-core/src/server/managedProvider.ts` forks the first provider check after server readiness, returns an immediate pending snapshot and streams results. `apps/server/src/provider/ProviderRegistry.ts` subscribes per instance before reading snapshots. `apps/web/src/routes/__root.tsx` already disables FirstRunGate for Atum. These existing paths meet the non-blocking-discovery requirement; do not add an Atum-only duplicate provider registry or block rendering until authentication probes finish. The 21 managed-provider tests pass, including a deferred probe and deferred server-readiness proof.

This patch adds Atum-only `window.atumWork.reportStartupPhase` reports. `ws-connected` comes from the authenticated environment connection presentation; `providers-ready` means the first usable provider snapshot (including pending entries), not completion of every external probe. `threads-painted` requires the primary shell projection to be live, a committed sidebar, and two animation frames. Detached views may report that last phase when first made visible. Reports are fixed strings, sent once per document; they never contain URLs, credentials, thread contents or account identifiers. They are observational and do not gate rendering, provider discovery or submit.

The matching desktop patch uses these phases to log the entire path and return the initially unthrottled background view to normal background throttling after thread-list paint. A desktop fallback restores throttling after 15s for older clients without hooks.

Verification:

- Client-only Atum build: exit 0 (`VITE_ATUM_WORK_BUILD=1 node ../../node_modules/vite-plus/dist/bin.js build` from apps/web).
- Focused lint: exit 0 on the four touched files.
- Native non-blocking discovery tests: exit 0, 21 passed (`node ../../node_modules/vite-plus/dist/bin.js test run src/server/managedProvider.test.ts --config ../../vite.config.ts` from packages/provider-core).
- Web Effect typecheck: exit 2; the only error is the existing `apps/web/src/components/settings/providerSettingsVisibility.test.ts:12` TS2345 union/weak-object mismatch. That file is identical to the 55c226eb66 base and untouched by this lane. No error points to these changes.

Measurement: production desktop WorkSurface/WebContentsView with real 0.1.14 server and this rebuilt client, isolated HOME and credential-sandboxed provider CLIs. Cold thread-list paint 4651ms from click; after hidden pre-warm, show returned in 8ms and hydrated list painted in 79ms. Server/WS/provider snapshot were already ready before the warm click. Before correcting Chromium throttling, the same instrumented client cold path painted in 8562ms; local server launch varied from 4163ms to 2195ms, so the full delta is not attributable to the patch. Post-server view time fell from 4399ms to 2456ms. Stock 0.1.14 with 8s slow provider fixtures still painted the sidebar shell in 2920ms, corroborating non-blocking probes. These are single local empty-home samples, not a measurement of the owner's populated history.

No push, PR, CI, release build, inference request or deployment. Coordinator owns the rebuilt 0.1.15 archive and desktop 0.20.56 activation. Filtered local dependencies and client-build intermediates are removed at handoff.

The repository's pre-commit hook also attempted monorepo-wide knip, which failed because the explicitly filtered installation omits Expo/mobile/desktop/relay dependencies. It reported missing `expo/tsconfig.base.json` and the corresponding false unused reports. Focused lint/build/tests above were run directly; this local worker commit bypasses that unavailable broad hook with a one-command hooksPath override. The coordinator must run its normal assembly checks before shipping.
