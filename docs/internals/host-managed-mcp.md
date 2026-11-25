# Host-managed MCP servers

A host embedding the T3 server can place `managed-mcp-servers.json` in the
server state directory (usually `<T3CODE_HOME>/userdata`). The file is an array
of records with `name`, `url`, and `authorizationHeader`. Write it atomically
with owner-only permissions before starting the server. T3 reads it when it
builds a provider session configuration. Missing or invalid files yield no
host-managed servers. T3 reserves the names `t3-code` and `t3-code-direct`.

The settings API is shared with clients and provider-specific launch arguments
cannot cover all drivers. The host file keeps the setting local to one T3
server and leaves each provider's own MCP configuration in place. Claude and
Codex register the endpoints over HTTP. ACP providers use HTTP when available,
or the existing stdio bridge when their negotiated transport requires it.

Give providers revocable local credentials if the host owns an account token.
Providers may retain the runtime configuration for an open session. The host
must revoke access at its endpoint before removing this file on sign-out.
Replacing the file alone does not revoke tools for a session that is already
open. Atum Desktop handles token renewal at its forwarding endpoint so the
provider configuration for a running session can stay stable.
