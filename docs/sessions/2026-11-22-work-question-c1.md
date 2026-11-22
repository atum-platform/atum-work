# Atum Work toolkit — local checkpoint

Status: partly built, not live. Companion desktop connector work is committed separately. No push, PR, CI, deployment or paid model calls.

The full bundled-server source is maintained in this separate fork under apps/server/src. There is no complete server source vendor in the desktop tree. The desktop still pins commit 5d8d30d04ee11af5ba92d5aa40a7778505f04cff (0.1.11); the requested origin/main base for this checkout is 0b02be3d5. No runtime repin was performed.

A single `ask_my_agent` toolkit is registered in the native MCP server, reusing native provider MCP injection. It is discoverable only in a configured Work server and only with thread credentials; outside OAuth/peer-link clients and link-origin threads are refused. The caller comes from McpInvocationContext. Live thread ownership and actual provider selection are rechecked around the private loopback request. The startup connector token is consumed and removed from process.env before provider children can inherit it. Redirects, arbitrary endpoints and non-loopback transport are rejected.

Protected/unknown answer release is closed even for Atum until certified routing and durable transcript fencing exist. This is deliberate fail-closed incomplete work, not a completed Google-on-Atum release. The main connector independently withholds protected data. Clean answers can use the transport; nothing here restricts the agent to read-only actions.

Verification: five dependency-free fake transport tests pass, covering four provider identities and provider change during wait, plus protected withholding and endpoint refusal. These are not native driver integration tests. Package typecheck and lint could not complete without the missing fork toolchain: pnpm began auto-installing dependencies, so both commands were cancelled and the partial node_modules removed. No paid eval was run.

Remaining: exact-pin native MCP tests with fake provider drivers; full server typecheck/lint; certify managed Atum routing; durable protected thread state and enforcement across model selection, resume and auxiliary inference; main-side authoritative release revalidation; runtime archive assembly by the coordinator. Do not ship this checkpoint as the completed C release.
