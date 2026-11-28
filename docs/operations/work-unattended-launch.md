# Unattended Claude launches from S2

Use the existing Work MCP `t3_thread_launch` tool with `unattended: true`.
Before forwarding evidence, look for `t3_thread_launch.inputSchema.properties.unattended`
in the selected Work build's `tools/list` response. A build without the field
cannot accept an unattended launch. The caller must have an authenticated
Work native forward grant with audience `owner_schedule`.

```json
{
  "scratch": true,
  "title": "Scheduled sweep",
  "modelSelection": { "instanceId": "claudeAgent", "model": "<advertised model ID>" },
  "message": "<draft request and bounded evidence>",
  "clientRequestId": "<stable request ID for this occurrence>",
  "unattended": true
}
```

Use the selected Claude provider's advertised instance ID. Work creates a
hidden thread and starts its first run with the evidence in `message`. Supply
a plain-text prompt without a leading slash command. Omit attachments, MCP
servers, provider output schema and automatic title generation. The normal
launch receipt includes `threadId` and `runId` for read and wait. A
non-Claude selection returns `invalid_request` before thread creation.
A retry must reuse the original request ID, provider and model. After dispatch
may have been accepted, S2 retains ownership of settlement and the deadline.

Work stamps the restriction on the thread. Claude starts with `dontAsk`,
native permission prompts disabled, an empty tool catalog, strict MCP, and no
inherited settings, hooks, or workspace instructions. Work refuses startup
when it detects managed Claude policy because managed hooks can override
session settings. Use a test Mac on an unmanaged Claude plan for the canary.

Local verification used the pinned Claude Agent SDK 0.3.321 and Claude Code
2.1.321 against a loopback Anthropic API fixture. The SDK reported `dontAsk`
with zero tools and MCP servers, none of the hook or MCP sentinels ran, and the
request excluded the workspace instructions. When the fixture returned
unexpected Bash, Read, AskUserQuestion and MCP tool calls, Claude rejected
all four with zero prompts or sentinel effects. The fixture used a dummy API
key and made zero paid model calls. OAuth on the installed test Mac and the
end-to-end S2 dispatch still need verification before activation.
