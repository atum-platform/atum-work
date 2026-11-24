# Agent instructions

The environment's `userdata/settings.json` accepts `agentInstructions`, an editable string, empty by default in upstream builds. Atum archives automatically default to the orientation in `agent-instructions.txt` when the field is absent; an explicit empty string disables it. `projectSettingsOverrides[projectId].agentInstructions` replaces it for one project; an empty project string explicitly clears the environment instruction. The existing settings patch API accepts the same field. This slice does not add a settings screen.

The text must contain fewer than 4,000 UTF-8 bytes (not characters). Oversized settings are rejected, never silently truncated. [agent-instructions.txt](./agent-instructions.txt) is the small Atum orientation example; it is the Atum archive default and is not a global T3 default.

T3 snapshots resolved text when it creates a thread's provider MCP session. It reuses the snapshot on subsequent turns and capability credential replacement, preserving the cached prefix. Edit settings for fresh sessions; existing sessions keep their snapshot until their MCP session is cleared. No text is appended to user messages for Codex or Claude.

Native delivery uses Codex's separate `t3_agent_instructions` additional-context entry, Claude Code's preset system-prompt append, ACP's existing runtime instruction path (including Antigravity, Grok, Kiro, fx and registry providers), OpenCode's system instruction path, Cursor/Muse runtime context, and Pi's `before_agent_start` extension. Pi receives a T3-owned internal environment value, cleared before injection; it is not a new user-facing configuration source. No provider homes or credentials are modified.

Providers without a T3 MCP session receive no configured text. Browser/device instructions retain their existing capability gates. The orientation example refers only to generic delegation tools and the owner's playbook; it names no model. Cloud-specific `ask_my_agent` guidance remains part B2, after a bound tool exists.

Validation: `apps/server` agent instructions, Codex context, context budget and session manager tests; server typecheck; Pi extension/injection tests. The local Hermes power spike in the app repository also runs two turns in one pinned native T3 thread, changes the setting between turns and asserts identical Codex additional context.
