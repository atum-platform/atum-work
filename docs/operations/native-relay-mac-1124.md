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

Assembly verification: server `effect-tsgo tsrs --noEmit` exit 0. Native toolkit
3/3 passed after session metadata migration. Cold client recognition refreshes
the host association only during OAuth approval; ordinary clients never fetch
S2 during tool calls. The checked consent snapshot is reused when issuing the
native EnvironmentAuth session, preventing a second-read identity race.
Reverse-tool failures now identify their stage with a fixed diagnostic code;
no credentials or file contents appear in those messages. `accept_local.sh`
provides the combined toolkit/startup/chat/fault reproduction entry point.

Confirmed reverse-tool bug: AuthSessions stored individual metadata columns,
so adding a field to the public schema alone silently discarded the consent.
Migration 111 adds a nullable metadata column to the existing session table;
SessionStore and the repository carry it through issue/read/verify. No second
session store is introduced. Real Hermes → real Work → cloud tools → Matrix
chat proof now passes (2026-11-24, exit 0; `/private/tmp/native-mac-chat-fixed.json`).
An initial broader test run used host Node 23.10 and failed its required SQLite
API check; the corrected run explicitly uses Node 24.21.

Final ancestry correction: rebasing replayed runtime changes without retaining
38ace137e5 as an ancestor. Joined the original runtime branch after comparing
all seven conflicts; the tested current tree already contained every runtime
change, and the merge changes no source bytes. Both ac9118cf5 and 38ace137e5
are now explicit ancestors. Broader native Node 24 suite: 54 tests passed.
Real TCP drop/restart/live revoke fault harness exits 0: same request replay,
restart cancellation with no duplicate send, and HTTP 403 mid-turn on revoke.
The fixture did not create a recovery successor; it proves cancellation rather
than successful automatic continuation. Connect HTTPS/real subscription logins
are deliberately outside the local decoy proof.

Final local receipts are in `native-relay-local-acceptance.json`. The packaged
server bundle also starts successfully, and real ordinary-client/linked-peer
OAuth passes with native admission configured. Two real servers demonstrate
that stopping Mac A leaves Mac B reachable. Regenerable Mobile/infra dependency
trees installed by workspace tooling were pruned after verification; retained
server dependencies still start the built server, keeping the workspace under
3 GB. No source, account state or credentials were removed.

The assembled script's newest run reached a new cloud-owned identity-seed
assertion at `chat_fixture.py:81` after native Work tools succeeded. The earlier
real chat receipt passes, but the stronger current fixture is not reported
green. The coordinator has the exact failure and keeps ownership of its
read-only cloud checkout. Do not interpret source completion as live activation.

The cloud owner fixed that assertion and froze source at d6d1dec739a1. Final
proof now uses the real authenticated host receiver as well as Work, Hermes,
SOUL and memory, and Synapse. Its exact final command is running before the
last receipt is recorded. Additional local real OAuth checks prove stale
generation 403, fresh approval recovery, and foreign-Mac 403. Actual Electron
`session.fetch` preserves the cookie header used by native CSRF approval.
Desktop renderer native TypeScript check passes after linking the installed
streamdown dependency; the stock JS compiler was superseded by the native one.
