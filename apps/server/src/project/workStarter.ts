// @effect-diagnostics nodeBuiltinImport:off -- Read the host-staged skill from both launch and run preparation.
import * as NodeFSP from "node:fs/promises";
import * as NodePath from "node:path";
import type { WorkDocumentFormat, WorkStarterFile } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";

import { officeStarters } from "@t3tools/shared/workOfficeStarters";

const starterFormats = {
  docx: {
    name: "Untitled.docx",
    skill: "work-document",
    description: "Create and revise editable Word documents.",
    instructions:
      "Use native Word headings, paragraphs, lists and tables. Keep text editable. Render the result with the local authoring runtime and check pagination and overflow.",
  },
  xlsx: {
    name: "Untitled.xlsx",
    skill: "work-spreadsheet",
    description: "Create and revise editable Excel workbooks.",
    instructions:
      "Use formulas for derived values and native charts for visualizations. Check formula references, recalculate a copy with the local authoring runtime and verify results against known values.",
  },
  pptx: {
    name: "Untitled.pptx",
    skill: "work-slides",
    description: "Create and revise editable PowerPoint slides.",
    instructions:
      "Use editable text and shapes and preserve a supplied slide master. Keep slide content in bounds and render all slides with the local authoring runtime to check layout.",
  },
  svg: {
    name: "Untitled.svg",
    skill: "work-design",
    description: "Create and revise editable SVG designs.",
    instructions:
      "Use editable HTML or SVG and keep the design self-contained. Exclude scripts, external resources and embedded documents. Work generates the PNG preview when it saves the design.",
  },
} satisfies Record<
  WorkDocumentFormat,
  { name: string; skill: string; description: string; instructions: string }
>;

const blankDesign =
  '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540"/>\n';

export const workDesignSkill = Effect.fn("Work.readDesignSkill")(function* () {
  const staged = process.env.ATUM_WORK_DESIGN_SKILL;
  if (!staged || !NodePath.isAbsolute(staged)) return undefined;
  const skill = yield* Effect.tryPromise({
    try: () => NodeFSP.readFile(staged, "utf8"),
    catch: () => undefined,
  }).pipe(Effect.orElseSucceed(() => undefined));
  return skill?.trim() ? skill : undefined;
});

export const workStarterFile = (format: WorkDocumentFormat): WorkStarterFile => ({
  format,
  relativePath: starterFormats[format].name,
});

export const prepareWorkStarter = Effect.fn("Work.prepareStarter")(function* (
  folder: string,
  format: WorkDocumentFormat,
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const starter = starterFormats[format];
  const body = [
    `The starting file for this Work session is \`${starter.name}\`.`,
    "Use the host-provided local authoring runtime when available. If the required tool is unavailable, report that and preserve the starting file.",
    starter.instructions,
  ].join("\n\n");
  const stagedSkill = format === "svg" ? yield* workDesignSkill() : undefined;
  const skill =
    stagedSkill ??
    [
      "---",
      `name: ${starter.skill}`,
      `description: ${starter.description}`,
      "---",
      "",
      body,
      "",
    ].join("\n");
  const skillDirectory = path.join(folder, ".claude", "skills", starter.skill);
  const exclusive = { flag: "wx" } as const;
  yield* fs.makeDirectory(skillDirectory, { recursive: true });
  yield* fs.writeFileString(path.join(skillDirectory, "SKILL.md"), skill, exclusive);
  if (stagedSkill !== undefined) {
    const agentsSkillDirectory = path.join(folder, ".agents", "skills", starter.skill);
    yield* fs.makeDirectory(agentsSkillDirectory, { recursive: true });
    yield* fs.writeFileString(path.join(agentsSkillDirectory, "SKILL.md"), skill, exclusive);
  }
  yield* fs.writeFileString(
    path.join(folder, "CLAUDE.md"),
    `Invoke the ${starter.skill} skill when working on the document in this session.\n\n${body}\n`,
    exclusive,
  );
  yield* fs.writeFileString(path.join(folder, "AGENTS.md"), body + "\n", exclusive);
  const file = path.join(folder, starter.name);
  if (format === "svg") {
    yield* fs.writeFileString(file, blankDesign, exclusive);
  } else {
    yield* fs.writeFile(file, Buffer.from(officeStarters[format], "base64"), exclusive);
  }
});
