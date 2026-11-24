# Native T3 local assembly on runtime 0.1.15

Rebased native bridge 691a1a4e3c onto 38ace137e5 (`feat/work-runtime-0.1.15`), yielding f1638eff2 before the final verification commit. No conflicts. App merged origin/atum-main de7ee329575 with a merge commit; credential-channel conflict preserved both Brain and native T3 keys. No push, PR, CI or deployment.

Native inventory: existing MCP OAuth, McpSessionRegistry, native provider lifecycle, toolkit caller validation and private connector are reused. No custom isolated worker or provider CLI inference was added. Provider homes are decoys and telemetry is off.

Local real-process evidence lives in the app `docs/session-logs/2026-11-24-native-t3-chat-evidence.json`. Real AIAgent memory dispatch is reached via Work's native provider-session MCP credentials, private consent projection and registration, then NativeClient sends/follows a real Work run and gateway delivery posts exactly one reply into a disposable Synapse room. Replay sends no further event; ledger delivered. The Codex app-server is a deterministic protocol fixture, not a paid model. The host bootstrap is a startup-secret-authenticated fixture, not deployed platform control-plane acceptance.

Checks: three native-caller/forward/reverse Node tests pass (exit 0); full server TypeScript check passes (exit 0, suggestions only); changed-source lint passes (exit 0); AgentInstructions + connector + transport + OAuth suites 21 passed (exit 0). Runtime inherited an Effect diagnostic and inline schema compilation lint failure in AgentInstructions.test.ts; corrected by explaining the filesystem fixture import and reusing the existing decoder.

Initial command/environment failures were corrected: tsgo command should be effect-tsgo; server tests run from apps/server; filtered installation needs the existing scripts/oxlint dependency links. No source gate was disabled. Dependency trees are removed after verification for disk headroom.

Pending activation: Connect HTTPS issuer/resource/callback, one-tap UI/renewal, real providers, deployed controller association projection/private host route. Local fixture proves the source interfaces, not a deployed authenticated controller. No broad device/relay removal is authorized; see the app retirement plan.
