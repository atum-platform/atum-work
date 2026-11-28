import { workInstructionText, workToolName } from "@t3tools/shared/workToolNames";
import { McpSchema } from "effect/ai";
import * as Context from "effect/Context";

export class WorkToolView extends Context.Reference<boolean>("atum/work/WorkToolView", {
  defaultValue: () => false,
}) {}

// JSON Schema strings in enums, examples, property names and defaults are data contracts.
function projectSchema<T>(value: T): T {
  if (Array.isArray(value)) return value.map(projectSchema) as unknown as T;
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => {
      if ((key === "title" || key === "description") && typeof child === "string") {
        return [key, workInstructionText(child)];
      }
      if (key === "default" || key === "examples" || key === "enum" || key === "const") {
        return [key, child];
      }
      return [key, projectSchema(child)];
    }),
  ) as T;
}

export function projectWorkTool(tool: McpSchema.Tool): McpSchema.Tool {
  return new McpSchema.Tool({
    ...tool,
    name: workToolName(tool.name),
    ...(tool.description === undefined
      ? {}
      : { description: workInstructionText(tool.description) }),
    ...(tool.title === undefined ? {} : { title: workInstructionText(tool.title) }),
    ...(tool.annotations?.title === undefined
      ? {}
      : {
          annotations: { ...tool.annotations, title: workInstructionText(tool.annotations.title) },
        }),
    inputSchema: projectSchema(tool.inputSchema),
    ...(tool.outputSchema === undefined ? {} : { outputSchema: projectSchema(tool.outputSchema) }),
  });
}
