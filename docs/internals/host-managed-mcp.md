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

An operator enables this path with `T3CODE_THREAD_MCP_ORIGIN`, a comma-separated
list of exact HTTPS origins. HTTP is accepted for `127.0.0.1` fixtures. A
missing or invalid list disables attachments. Exact origins pin the hosts and
ports Work can reach on the relay's behalf, including when more relay hosts
are added to the same deployment.

Each outside relay uses its own operation-capable OAuth bearer on Connect's
`/mcp`. Work binds attachments to the verified OAuth **session ID** used by
the launch. This is the identity T3 already uses to isolate launch retries
and linked-environment ownership. Every OAuth session can attach to the
threads it launches. A new OAuth session starts new threads. Caller labels,
transport session IDs, and credentials issued to provider threads convey no
attachment authority.

On the MCP `tools/call` request, send `Authorization: Bearer <work-token>`
and `X-API-Key: {"relay":"Bearer <upstream-token>"}` alongside the usual
Streamable HTTP headers. `X-API-Key` is a JSON object keyed by `headersRef`.
Work caps the object header at 8,192 characters and the token in each
`Bearer` value at 2,048 characters. Keep this redacted header out of relay
logs and persistent retry payloads.

- On `t3_thread_launch`, pass `title`, `projectId` or `scratch: true`, a
  `clientRequestId` for recovery, and optionally `message` and `mcpServers`.
  Use the returned `threadId` verbatim.
- On `t3_thread_send`, pass `threadId`, `message`, and a fresh
  `clientRequestId` for each send. Omit `mcpServers` to keep the existing
  registration, pass `[]` to clear it, or pass the complete replacement list.
  Provide an `X-API-Key` value for each reference in a nonempty list.
- Each of the up to four `mcpServers` entries is
  `{name, url, headersRef, toolTimeoutMs?}`. Names must be unique, excluding
  `t3-code` and its `t3-code-` prefix. URLs can use any path on an allowed
  origin and must omit credentials, query strings, and fragments.

A nonempty attachment suppresses the host-managed Google and Owner Chats
servers. The relay supplies screened Google access through `atum_google`.
Owner Chats also exposes third-party text in previews and search results. Its
untrusted-text markers frame that content for the model, which would still
receive it outside the relay's screening. Threads without attachments retain
the host account tools.

A send with an attachment update requires an idle thread and `mode` set to
`auto` (the default) or `queue`. Send with `freshContext: true` for structural
changes (including clearing, reordering, or changing timeouts) on Codex, ACP,
or other non-Claude providers. Clearing restores the host account tools when
the next provider session opens. Claude opens a new query when attachment
changes alter the host account list and resumes the existing conversation
without requiring `freshContext`. Credential rotation keeps the provider URL
byte-stable and needs no provider restart. Within the current Work process an
accepted `clientRequestId` replays dispatch without resetting credentials.

MCP tool refusals use `result.isError: true` with a JSON-encoded failure in
`result.content[0].text`. Read its `code` to distinguish:

| Code                                | Meaning                                                                                             |
| ----------------------------------- | --------------------------------------------------------------------------------------------------- |
| `thread_mcp_attachment_denied`      | Attachments are disabled or this OAuth session has no attachment ownership.                         |
| `thread_mcp_update_busy`            | A turn is active, or the send requested `steer` or `restart`. Retry an idle `auto` or `queue` send. |
| `thread_mcp_fresh_context_required` | The provider needs `freshContext: true` for this server list change.                                |
| `invalid_request`                   | An attachment URL, name, or authorization reference is unacceptable.                                |
| `thread_not_found`                  | The send target is gone.                                                                            |

Missing or invalid Work credentials get HTTP 401 from `/mcp`. A read-only
grant can be refused by MCP's normal `capability_denied` check before it
reaches attachment admission.

Work keeps the registry and upstream credentials in process memory. Providers
get an opaque URL on a separate IPv4 loopback socket. The listener forwards
Streamable HTTP requests only to allowed origins, preserves `Mcp-Name` on tool
calls, supplies Authorization at request time, and refuses redirects. Its POST
deadline defaults to 180,000 ms.
`toolTimeoutMs` accepts an integer from 1,000 to 7,200,000 ms (two hours).
An expired deadline or an aborted provider HTTP request closes the upstream
request, including a streaming response. An upstream failure or deadline
before response headers gets HTTP 502 on the provider's loopback request.
Providers such as ACP agents can enforce shorter deadlines independently.

After Work restarts, replay the launch with the same OAuth credential and
original `clientRequestId` to restore ownership and the attachment. The
loopback URL is bearer-equivalent while registered, so keep it out of logs.
Claude receives the URL over stdin through `setMcpServers` at query open and
when the list changes on a live query. The adapter strips the server list
before it invokes the SDK, keeping the capability out of Claude's argv.
ACP uses the existing HTTP and stdio registration paths.

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
