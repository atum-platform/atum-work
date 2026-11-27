// @effect-diagnostics nodeBuiltinImport:off -- Reads the bundled instructions fixture.
import * as NodeFS from "node:fs";
import { describe, expect, it } from "vite-plus/test";
import * as Schema from "effect/Schema";
import {
  AgentInstructions,
  ProjectId,
  DEFAULT_SERVER_SETTINGS,
  ServerSettingsPatch,
} from "@t3tools/contracts";
import { resolveProjectSettings } from "@t3tools/shared/projectSettings";
import { buildRuntimeInstructions } from "@t3tools/provider-core/server/runtimeInstructions";
import { buildCodexAdditionalContext } from "./CodexDeveloperInstructions.ts";
import { makeClaudeQueryOptions } from "../orchestration-v2/Adapters/ClaudeAdapterV2.ts";

const decodeSettingsPatch = Schema.decodeSync(ServerSettingsPatch);
const decodeAgentInstructions = Schema.decodeUnknownSync(AgentInstructions);

describe("agent instructions", () => {
  it("ships a short Atum orientation without personal paths or legacy product names", () => {
    const orientation =
      process.env.VITE_ATUM_WORK_BUILD === "1"
        ? DEFAULT_SERVER_SETTINGS.agentInstructions
        : NodeFS.readFileSync(
            new URL("../../../../docs/user/agent-instructions.txt", import.meta.url),
            "utf8",
          );
    expect(orientation).toMatch(/\S/);
    expect(new TextEncoder().encode(orientation).byteLength).toBeLessThan(4000);
    expect(orientation).not.toMatch(/(?:\/(?:Users|home|root)\/|[A-Z]:[\\/]Users[\\/])/i);
    expect(orientation).not.toMatch(/\b(?:T3|Hermes)\b/i);
  });

  it("uses the build default, inherits environment and lets a project clear it", () => {
    const project = ProjectId.make("instructions-project");
    if (process.env.VITE_ATUM_WORK_BUILD !== "1") {
      expect(DEFAULT_SERVER_SETTINGS.agentInstructions).toBe("");
    }
    expect(decodeSettingsPatch({ agentInstructions: "" }).agentInstructions).toBe("");
    const settings = { ...DEFAULT_SERVER_SETTINGS, agentInstructions: "environment" };
    expect(resolveProjectSettings(settings, project).settings.agentInstructions).toBe(
      "environment",
    );
    expect(
      resolveProjectSettings(
        { ...settings, projectSettingsOverrides: { [project]: { agentInstructions: "" } } },
        project,
      ).settings.agentInstructions,
    ).toBe("");
    expect(decodeSettingsPatch({ agentInstructions: "owner text" }).agentInstructions).toBe(
      "owner text",
    );
  });
  it("rejects oversized UTF-8 rather than silently truncating Codex's entry", () => {
    const decode = decodeAgentInstructions;
    expect(decode("a".repeat(3999))).toHaveLength(3999);
    expect(() => decode("a".repeat(4000))).toThrow();
    expect(() => decode("界".repeat(1334))).toThrow();
  });
  it("delivers exact stable text through each native channel", () => {
    const text = "You are in Atum.\nRead the owner's playbook.\n";
    const codex = () => buildCodexAdditionalContext({ model: "fixture", agentInstructions: text });
    expect(codex().t3_agent_instructions?.value).toBe(text);
    expect(codex()).toEqual(codex());
    expect(codex().t3_code_runtime?.value).not.toContain(text);
    expect(buildCodexAdditionalContext({ model: "fixture" })).not.toHaveProperty(
      "t3_agent_instructions",
    );
    const claude = makeClaudeQueryOptions({
      modelSelection: { instanceId: "claude" as never, model: "fixture" },
      nativeThreadId: "fixture",
      resume: false,
      cwd: null,
      agentInstructions: text,
    });
    expect(claude.systemPrompt).toMatchObject({
      type: "preset",
      preset: "claude_code",
      append: expect.stringContaining(text),
    });
    expect(buildRuntimeInstructions({ harness: "Antigravity", agentInstructions: text })).toContain(
      text,
    );
  });
});
