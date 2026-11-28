import { OrchestratorMcpFailure } from "@t3tools/contracts";
import * as Schema from "effect/Schema";
import { McpSchema, Tool, Toolkit } from "effect/ai";

import {
  FeedbackAwaitingApproval,
  FeedbackInput,
  FeedbackSubmitResult,
} from "../../../feedback/FeedbackReport.ts";
import * as Feedback from "../../../feedback/FeedbackService.ts";
import * as ThreadManagementService from "../../../orchestration-v2/ThreadManagementService.ts";
import * as McpInvocationContext from "../../McpInvocationContext.ts";

const shared = {
  failure: OrchestratorMcpFailure,
  failureMode: "return" as const,
  dependencies: [
    Feedback.FeedbackService,
    McpInvocationContext.McpInvocationContext,
    ThreadManagementService.ThreadManagementService,
  ],
};

export const FeedbackToolkit = Toolkit.make(
  Tool.make("t3_feedback", {
    ...shared,
    description:
      "Report T3 Code tool or CLI problems, confusing guidance, missing features, or other product feedback. Paraphrase. Exclude user code and never quote messages, code, files, or names. When asked, open the approval card now. The user chooses whether to include the selected `turns`. Keep conversation text out of the report.",
    parameters: FeedbackInput,
    success: Schema.Union([FeedbackSubmitResult, FeedbackAwaitingApproval]),
  })
    .annotate(Tool.Destructive, false)
    .annotate(McpSchema.EnabledWhen, McpInvocationContext.hiddenWhileFeedbackOff),
);
