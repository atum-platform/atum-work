# Assistant-backed Work threads

A trusted native relay can set `assistantLearning: true` on `t3_thread_launch`, using visible Scratch, a stable `clientRequestId`, and one `atum-agent-tools` attachment. The session needs native owner-DM consent. Its authorized origin and `/a/<assistant>/mcp` path must match the enrolled assistant. Native OAuth and consent binding govern subsequent attachment updates. The loopback URL survives ordinary bearer rotation, so a Work provider can keep its session prefix and schema. Direct composer sends to a registered learning thread are refused until the composer can route them through the selected assistant. Local Scratch creation remains available independently.

The assistant service holds the per-turn bearer and implements the native tool surface. The Work runtime preserves the original launch request namespace for same-connection reattachment. The renderer can open the returned thread using the existing host command. Desktop and the authenticated assistant ingress still need to submit Work turns through the relay before enabling this path in an installed build. Signed end-to-end provider tests and local-file taint screening remain follow-up work.

The focused tests cover existing OAuth and loopback behavior, owner and assistant mismatch, unavailable attachment credentials, and endpoint stability during rotation.
