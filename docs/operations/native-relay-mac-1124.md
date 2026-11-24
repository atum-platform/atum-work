# Mac native relay assembly (2026-11-24)

Local-only implementation; no push, CI, deployment or owner credentials.
Connect T1 is the base; runtime 0.1.15 is retained as an ancestor.
Replace separate bearer-hash storage with EnvironmentAuth client metadata.
Only host-registered Atum clients require forward consent; linked peers remain native.
Consent validates the local Mac identity, caches at most one second, and rechecks before releasing responses.
Verification: frozen `pnpm install --filter t3... --ignore-scripts --frozen-lockfile` exit 0;
Atum toolkit node tests 3/3 pass with `ATUM_WORK_MAC_ID=mac`;
`python3 scripts/native-t3-bridge-mac/start_smoke.py` starts the actual HTTP server with an empty temporary home, exit 0.
Rebased onto finished Connect T1 ac9118cf5; runtime 38ace137e5 remains an ancestor.
Thread reads expose native restart predecessor links and assistant message phase without inferring either.
Desktop route acceptance remains in progress; this checkpoint is not live.
