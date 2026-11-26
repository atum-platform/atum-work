# Disposable Mode B Slice 0 attachment

This branch adds a local test seam to the Claude adapter's host-managed account
MCP path. A trusted controller writes one current attachment as JSON lines to an
inherited descriptor named by `MODEB_SLICE0_ATTACHMENT_FD`. Entries carry
`threadId`, `origin`, `bearer` and `expiresAt` (epoch milliseconds). Use a
loopback origin only. A subsequent line replaces the entry. Close the pipe to
clear it. The Claude adapter reads it on query open, only for the matching thread
and outside read-only sandboxes. The adapter includes its header in the query
policy key, so rotating the token changes the key and prevents ordinary live
query reuse. The spike adds no model-facing field or persisted server manifest.

This seam is for the synthetic fixture. Provider trace, restart, session reuse,
permissions and non-loopback behavior require separate proof before rollout.
