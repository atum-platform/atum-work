import { OrchestratorMcpFailure } from "@t3tools/contracts";
import * as Schema from "effect/Schema";
import { McpSchema, Tool, Toolkit } from "effect/ai";
import * as McpInvocationContext from "../../McpInvocationContext.ts";
import * as ThreadCommandExecutor from "../../../orchestration-v2/ThreadCommandExecutor.ts";
import * as ThreadManagementService from "../../../orchestration-v2/ThreadManagementService.ts";
import * as McpProviderSessions from "@t3tools/provider-core/server/McpProviderSessions";
import * as McpSessionRegistry from "../../McpSessionRegistry.ts";
const AskMyAgentTool = Tool.make("ask_my_agent", {
  description:
    "Ask one of the owner’s agents from Work. Use a stable request_id UUID. To poll the same question, reuse request_id and agent without question. The agent retains its normal capabilities.",
  parameters: Schema.Struct({
    agent: Schema.String,
    question: Schema.optionalKey(Schema.String),
    request_id: Schema.String,
  }),
  success: Schema.Struct({
    state: Schema.Literals(["answered", "waiting", "timed_out", "unavailable", "cancelled"]),
    request_id: Schema.String,
    question_event_id: Schema.optionalKey(Schema.String),
    answer: Schema.optionalKey(Schema.String),
    provenance: Schema.optionalKey(Schema.Literals(["non_google", "google", "unknown"])),
  }),
  failure: OrchestratorMcpFailure,
  failureMode: "return" as const,
  dependencies: [
    McpInvocationContext.McpInvocationContext,
    ThreadManagementService.ThreadManagementService,
    ThreadCommandExecutor.ThreadCommandExecutor,
    McpProviderSessions.McpProviderSessions,
    McpSessionRegistry.McpSessionRegistry,
  ],
}).annotate(McpSchema.EnabledWhen, McpInvocationContext.hiddenFromOutsideClients);
export const AtumToolkit = Toolkit.make(AskMyAgentTool);
