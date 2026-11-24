# Mac native relay assembly (2026-11-24)

Local-only implementation; no push, CI, deployment or owner credentials.
Connect T1 is the base; runtime 0.1.15 is retained as an ancestor.
Replace separate bearer-hash storage with EnvironmentAuth client metadata.
Only host-registered Atum clients require forward consent; linked peers remain native.
Consent validates the local Mac identity, caches at most one second, and rechecks before releasing responses.
Verification and desktop route acceptance are in progress; this checkpoint is not live.
