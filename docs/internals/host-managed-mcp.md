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
