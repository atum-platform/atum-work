# Host-managed account MCP

Atum Desktop embeds Work behind its existing loopback connector. The supervisor
passes the connector address and delivers the connector token in a one-use
inherited pipe. Work verifies a fresh proof from the connector before it
publishes account servers to a provider. A missing, stale, or unavailable
connector leaves sessions usable without the account tools.

Provider MCP credentials authorize only Google and Owner Chats, and cannot
call the connector's other routes. The connector derives those credentials and
the names independently from its in-memory token. The names are stable for
one connector lifetime and keep a repository's configured server names from
shadowing the account tools. Codex also overrides same-name project config
with the per-thread registration. Work does not persist an account MCP
manifest.

Claude registers account servers over its control channel. Codex sends them as
optional per-thread configuration. ACP uses a homogeneous HTTP list only when
the flavour enables it and the agent advertises HTTP support. Otherwise ACP
uses its required stdio transport for both the built-in and account servers.
Sessions without account servers can continue to use ACP-native MCP.

## 2026-11-26 integration

The public Work fork's product integration base is
`origin/feat/work-runtime-0.1.16`, which contains the branded runtime and native
Connect bridge. The account tool layer reuses the toolkit's startup pipe reader,
so both consumers see the same endpoint and credential. Account tool names use
the `atum-account-` prefix and a connector-specific suffix. A connector proof
failure leaves provider sessions usable with their usual tools.

A local Node 26.13.1 smoke test read the same cached config twice from a real
inherited FIFO, confirmed the environment fields were cleared, and verified
that an invalid descriptor leaves the toolkit unconfigured.

## Relay-supplied thread MCP

An operator enables this path with `T3CODE_THREAD_MCP_ORIGIN` (an exact HTTPS
origin, or IPv4 loopback HTTP for a local fixture) and
`T3CODE_THREAD_MCP_CLIENT_SESSION` (the relay's authenticated Work MCP client
session ID). The relay attaches servers to threads it launches on this Work
environment. Work uses the authenticated session ID for admission. A label or
a provider thread credential cannot grant attachment access.

The relay supplies `mcpServers` on `t3_thread_launch` and between turns on
`t3_thread_send`. Each entry names a server, gives its MCP URL and
`headersRef`, and can set `toolTimeoutMs`. The relay sends a JSON object
mapping references to full Authorization values in the request's `X-API-Key`
header, which the HTTP tracer redacts. Keep that header out of relay logs
and persisted retry payloads. The relay can omit the list to keep the
existing registration, or pass an empty list to clear it. A send with an
attachment update needs an idle thread. Requests with the same accepted
`clientRequestId` replay the original dispatch without resetting its credentials.

Work keeps the registry and upstream credentials in process memory. Providers
get an opaque URL on a separate IPv4 loopback socket. The listener forwards
Streamable HTTP requests only to the configured origin, supplies Authorization
at request time, and refuses redirects. Rotating a bearer keeps the provider
URL byte-stable. Restarting Work requires replaying the authenticated launch
with its original request ID to re-establish the attachment before sending.
On send, Codex and ACP require `freshContext` for structural changes to the
server list. Credential rotation needs neither a new registration nor a fresh
provider session. Claude applies structural changes through the native
`setMcpServers` control request on its live query. ACP registrations follow
the existing HTTP and stdio paths. ACP agents can enforce their own shorter
tool deadlines.

The isolated rotation fixture used the pinned Agent SDK 0.3.321 and its
bundled macOS ARM64 Claude executable. A single live query performed two
`setMcpServers` registrations for the same server name and URL. Both
reported the server connected. The fixture received `initialize` and
`tools/list` with each successive synthetic bearer. The test used a fresh
home and a loopback endpoint for all requests and sent no model prompt.

A second run registered Work's loopback URL once and invoked a fixture tool
through the same Claude query before and after replacing the Work credential.
The upstream recorded first the old bearer and then the new one. The second
call returned in 150.27 seconds under a 180-second budget. A scan of the four
files created in the isolated Claude home found neither synthetic bearer.

## Interim messages on the relay

The relay pages Work messages by position. It holds its position at a running
commentary item and forwards the text after the item completes as commentary.
Claude and ACP use the running phase while the provider is still deciding
whether the text is an update or an answer. They resolve it in place so a
relay poll during streaming cannot skip it.

ACP keeps chunks with the same native message ID together across tool calls.
A tool boundary can complete anonymous text immediately. Named text becomes
eligible once the adapter closes that message. Claude continues to treat a
native answer that finishes before a queued steer as a final answer.
