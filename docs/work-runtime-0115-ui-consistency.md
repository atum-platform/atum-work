# Work runtime 0.1.15 — 2026-11-24

State: local release input preparation; not published, installed or live. Coordinator owns assembly and shipping in desktop 0.20.56.

Based on UI consistency source 74a7b11105, including both UI rounds. The archive workflow default is stamped 0.1.15 using the same two version sites as 0.1.14. No product code changes in this checkpoint.

Build procedure: exact Node 26.13.1, filtered locked web/server/scripts dependency install, locked Rust monitor, then `node scripts/atum-work/build.mjs v0.1.11 atum-work/brand.json NODE_LICENSE OUTPUT v0.1.15`. The standard packer applies the required local ad-hoc signature for arm64 execution; no Developer ID, Keychain or notarization is used.

Output destination: `/Users/NM/.atum/operations/release-build-inputs/work-0.1.15/atum-work-0.1.15-darwin-arm64.tar.gz`, with SHA256 sidecar. Run the standard `scripts/atum-work/smoke.mjs` against the packaged archive; it unpacks into temporary storage, uses a decoy HOME, pairs only on loopback, verifies the brand and cleans up the server and temporary data. Coordinator handoff and desktop runtime note record the final digest and check results.

No push, PR, CI, cloud, provider authentication, signing credentials, installed state, rollback copies, or nested agents. Remove temporary build dependencies/toolchains and intermediates after verification.
