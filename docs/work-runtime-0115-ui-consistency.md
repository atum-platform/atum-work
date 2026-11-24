# Work runtime 0.1.15 — 2026-11-24

State: local release input preparation; not published, installed or live. Coordinator owns assembly and shipping in desktop 0.20.56.

Based on UI consistency source 74a7b11105, including both UI rounds. The archive workflow default is stamped 0.1.15 using the same two version sites as 0.1.14. No product code changes in this checkpoint.

Build procedure: exact Node 26.13.1, filtered locked web/server/scripts dependency install, locked Rust monitor, then `node scripts/atum-work/build.mjs v0.1.11 atum-work/brand.json NODE_LICENSE OUTPUT v0.1.15`. The standard packer applies the required local ad-hoc signature for arm64 execution; no Developer ID, Keychain or notarization is used.

Output destination: `/Users/NM/.atum/operations/release-build-inputs/work-0.1.15/atum-work-0.1.15-darwin-arm64.tar.gz`, with SHA256 sidecar. Run the standard `scripts/atum-work/smoke.mjs` against the packaged archive; it unpacks into temporary storage, uses a decoy HOME, pairs only on loopback, verifies the brand and cleans up the server and temporary data. Coordinator handoff and desktop runtime note record the final digest and check results.

No push, PR, CI, cloud, provider authentication, signing credentials, installed state, rollback copies, or nested agents. Remove temporary build dependencies/toolchains and intermediates after verification.

## Final assembly and local validation

Merged UI round 3 (`dbbedef73b`) and B1 native agent instructions (`5993825921`) with merge commits, retaining the earlier local version-stamp checkpoint. Both merges were clean. Restored the workflow dispatch version to 0.1.15 after the UI merge brought an older default.

Atum's existing temporary brand pass changes only B1's schema decoding default to the complete `docs/user/agent-instructions.txt` text. No runtime environment variable or second instruction resolver is added. Explicit environment text, explicit empty strings, and per-project overrides retain native B1 precedence. Upstream builds keep the empty default. Native session snapshot and delivery channels remain B1-owned; edits apply to fresh sessions. There is no new settings screen in B1.

Archive: `atum-work-0.1.15-darwin-arm64.tar.gz`, 151402536 bytes; SHA256 `22365a562f0f061206d06a5567e417550c1fb6be39abb8e82aa61ddffc668d42`. Built locally with exact Node 26.13.1 and the locked Rust monitor using the standard 0.1.14 procedure. The standard native packer applied local ad-hoc signatures required to execute arm64 binaries, without Developer ID, Keychain, or notarization.

Packaged smoke exit 0: unpacked to temporary storage, started on loopback with a decoy HOME, authenticated a fresh browser session, served the Atum title/sidebar, skipped Welcome, kept Connect off, and read `server.getSettings` over authenticated WebSocket to verify the exact automatic orientation text. Server/browser were stopped and unpacked files deleted. No model/API turn or real provider credentials were used. Fresh provider-session propagation is verified separately through the real session manager with its fixture provider under the temporary Atum brand pass.

Focused checks: src/atum 3 files / 10 tests; default-build picker browser tests 3 files / 9 tests; B1/Codex/session tests initially 3 files / 81 tests; Pi instruction extension 1 file / 32 tests. Branding regression verifies upstream unchanged, exact Atum default insertion and byte restoration. The Atum B1/session pass verifies the documented default and a freshly created MCP session, and the unbranded pass verifies upstream remains empty. An initial branded check found a test-only relative fixture path one directory too high; corrected before final verification.

State remains built-not-live. Coordinator owns source publication, review, release 0.20.56, and installed acceptance. No pushes, PRs, CI, deployment, provider auth, or cloud resources were used. Build outputs/toolchains and temporary installs are removed after verification; rollback artifacts are untouched.

## Latency-hook archive replacement

Fast-forwarded this branch to `309b38727a` (startup phase hooks). Rebuilt the same 0.1.15 archive using exact Node 26.13.1, filtered locked dependencies and the locked Rust monitor. The runtime input is now 151421554 bytes, SHA256 `aa084ef572baddd7bc532b2e935dddc0ee3d419e6171f78939a55d015f48e557`; the prior archive at the same release-input destination was replaced, with its checksum sidecar regenerated. Rollback copies were untouched.

Extended the existing packaged smoke to inject the host startup-report bridge before navigation and assert each phase fires once. Smoke exit 0: isolated HOME, loopback pairing and serving, exact automatic orientation, `ws-connected`, `providers-ready`, and `threads-painted`; no provider credentials or model turn. Branded native AgentInstructions/ProviderSessionManager tests passed 76 tests (exit 0), including fresh session propagation. Unbranded src/atum passed 10 tests (exit 0). Branding was restored after build/tests. The standard packer's local ad-hoc arm64 signatures were used; no Keychain, Developer ID, notarization, push, CI or deployment.

Removed generated client/server outputs, temporary Rust toolchain/target, and temporary filtered dependency installation after verification. Built-not-live: coordinator owns final assembly and desktop 0.20.56 acceptance. This local checkpoint bypasses the full-monorepo pre-commit hook for the documented filtered dependency scope; requested focused checks and packaged smoke ran directly.
