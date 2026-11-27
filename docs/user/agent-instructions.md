# Agent instructions

Atum Work archives use the [bundled orientation](./agent-instructions.txt) when the environment's `agentInstructions` setting is absent. You can set your own text in the environment's `userdata/settings.json`, and the desktop can set it through the existing settings patch API. Use an empty string to disable it. To replace or clear the instruction for one project, set `projectSettingsOverrides[projectId].agentInstructions`.

The text must contain fewer than 4,000 UTF-8 bytes. Work rejects oversized settings.

Work snapshots the effective text when it creates a thread's provider MCP session. Local threads, relay-launched threads, and delegated child threads all resolve the setting for their own project. Work reuses the snapshot across turns and capability credential changes to preserve the cached prefix. Settings changes apply to fresh sessions.

Work delivers the text through the provider's native instruction channel, such as Codex's additional context or Claude Code's system-prompt append. Delivery requires a provider MCP session.

**2026-11-27 (owner):** the shipped default orients the agent around Atum: assistants who hand tasks over, orchestration through native delegation, and which model family suits which job (Claude for thinking and design, ChatGPT/Codex for engineering and review, Gemini for writing, free OpenCode models for small tasks). It is deliberately short (under 1 KB). People will edit it from a card in Work settings (Atum Settings revamp).
