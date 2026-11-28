# Assistant-backed Work threads

A trusted native relay can set `assistantLearning: true` on `t3_thread_launch`, using visible Scratch, a stable `clientRequestId`, and one `atum-agent-tools` attachment. The session needs native owner-DM consent. Its authorized origin and `/a/<assistant>/mcp` path must match the enrolled assistant. Native OAuth and consent binding govern subsequent attachment updates. The loopback URL survives ordinary bearer rotation, so a Work provider can keep its session prefix and schema. Direct composer sends to a registered learning thread are refused until the composer can route them through the selected assistant. Local Scratch creation remains available independently.

The assistant service holds the per-turn bearer and implements the native tool surface. The Work runtime preserves the original launch request namespace for same-connection reattachment. The owner composer uses Desktop's existing authenticated Work request and receipt transport. It opens the returned visible thread through the standard Work route. The thread identifier carries the same assistant and session on follow-up, including after a change in the current assistant selection. The current provider selection travels with each turn. A standalone session can start locally when Desktop has no eligible relay before submission. An uncertain relay submission leaves the draft available for retry.

A completed S1 DOCX contributes its existing thread, run, and artifact identity. Desktop resolves it against the account's existing Work result receipt and passes its verified local DOCX path. The document remains on the Mac. The first supported path is text submissions from the primary Desktop Work environment with a managed assistant, plus S1 result references.

The composer displays a localized standalone status for an unbound local launch and an assistant connection error when the handoff cannot be confirmed.

Focused fixtures cover the owner composer handoff, standalone dispatch, owner and assistant mismatch, unavailable attachment credentials, and endpoint stability during rotation. Existing Hermes prompt snapshots retain their original bytes. A new Work session and a new chat session read the learned memory and skills from the same profile.

The advertised MCP tool list measures 62,686 bytes after adding the launch flag and session identity. Round 1 measured 62,448 bytes. The system prompt measurements are 6,245 bytes for Claude and 7,639 bytes for Codex.
