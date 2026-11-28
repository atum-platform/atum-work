import { workInstructionText } from "@t3tools/shared/workToolNames";
import type { AgentFeedbackMode } from "@t3tools/contracts";
import type { V2TurnStartParams__AdditionalContextEntry } from "effect-codex-app-server/schema";
import { buildRuntimeInstructions } from "@t3tools/provider-core/server/runtimeInstructions";

import {
  T3_CODE_BROWSER_TOOL_INSTRUCTIONS,
  T3_CODE_DEVICE_TOOL_INSTRUCTIONS,
  T3_CODE_ORCHESTRATION_SECTIONS,
} from "@t3tools/provider-core/server/orchestrationInstructions";

/** Codex silently truncates additionalContext values over 1,000 tokens, counted as UTF-8 bytes / 4. */
export const CODEX_ADDITIONAL_CONTEXT_VALUE_MAX_BYTES = 4_000;

export interface T3CodeToolAvailability {
  readonly browser: boolean;
  readonly device: boolean;
}

const normalizeAvailability = (
  availability: boolean | T3CodeToolAvailability,
): T3CodeToolAvailability =>
  typeof availability === "boolean" ? { browser: availability, device: false } : availability;

/** Instructions for unavailable tools would steer the model away from its remaining automation. */
const toolInstructions = (availability: boolean | T3CodeToolAvailability): string => {
  const tools = normalizeAvailability(availability);
  return [
    tools.browser ? T3_CODE_BROWSER_TOOL_INSTRUCTIONS : "",
    tools.device ? T3_CODE_DEVICE_TOOL_INSTRUCTIONS : "",
  ]
    .filter(Boolean)
    .join("\n\n");
};

export interface CodexRuntimeInfo {
  readonly agentFeedback?: AgentFeedbackMode;
  readonly workPresentation?: boolean | undefined;
  readonly model: string;
  readonly agentInstructions?: string | undefined;
  readonly modelName?: string | undefined;
  readonly reasoningEffort?: string | undefined;
}

/** Keep this outside collaboration mode; model-catalog mode text overrides client developer_instructions. */
export function buildCodexAdditionalContext(
  runtime: CodexRuntimeInfo,
  toolsAvailable: boolean | T3CodeToolAvailability = true,
): Record<string, V2TurnStartParams__AdditionalContextEntry> {
  const present = (text: string) => (runtime.workPresentation ? workInstructionText(text) : text);
  const tools = present(toolInstructions(toolsAvailable));
  const prefix = runtime.workPresentation ? "atum_work" : "t3_code";
  // Split values to fit per-entry caps; number keys because Codex emits them in key order.
  return {
    ...Object.fromEntries(
      T3_CODE_ORCHESTRATION_SECTIONS.map((section, index) => [
        `${prefix}_orchestration_${String(index + 1).padStart(2, "0")}`,
        { kind: "application" as const, value: present(section) },
      ]),
    ),
    ...(runtime.agentInstructions
      ? {
          [runtime.workPresentation ? "atum_agent_instructions" : "t3_agent_instructions"]: {
            kind: "application" as const,
            value: runtime.agentInstructions,
          },
        }
      : {}),
    [`${prefix}_runtime`]: {
      kind: "application",
      value: buildRuntimeInstructions({
        harness: "Codex",
        workPresentation: runtime.workPresentation,
        model: runtime.model,
        modelName: runtime.modelName,
        reasoningEffort: runtime.reasoningEffort,
      }),
    },
    ...(tools ? { [`${prefix}_tools`]: { kind: "application", value: tools } } : {}),
  };
}
