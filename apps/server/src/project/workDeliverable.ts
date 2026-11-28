// @effect-diagnostics nodeBuiltinImport:off -- Inspect the run-local file with a no-follow descriptor.
import * as NodeCrypto from "node:crypto";
import * as NodeFS from "node:fs";
import * as NodeFSP from "node:fs/promises";
import * as NodePath from "node:path";
import type { RunId, ThreadId, WorkDeliverableFormat } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import { SaxesParser } from "saxes";

import { validateWorkDocx, WORK_DOCX_MAX_BYTES } from "./workDocx.ts";
import { workDesignSkill } from "./workStarter.ts";

const filenames = { docx: "Memo.docx", html: "Design.html", svg: "Design.svg" } as const;
const designFormats = ["html", "svg"] as const;
const designMaxBytes = 512 * 1024;
const folderName = (artifactId: string) => `.work-output-${artifactId}`;
const shellArg = (value: string) => "'" + value.replaceAll("'", "'\\''") + "'";

interface WorkIdentity {
  readonly threadId: ThreadId;
  readonly runId: RunId;
  readonly artifactId: string;
}

const privateChannelAvailable = () => process.connected && process.send !== undefined;
const memoRuntime = () => {
  if (!privateChannelAvailable()) return undefined;
  const python = process.env.ATUM_WORK_MEMO_PYTHON;
  const helper = process.env.ATUM_WORK_MEMO_SCRIPT;
  return python && NodePath.isAbsolute(python) && helper && NodePath.isAbsolute(helper)
    ? { python, helper }
    : undefined;
};
export const workDeliverablesEnabled = privateChannelAvailable;

const send = (message: object) =>
  Effect.callback<boolean>((resume) => {
    if (!privateChannelAvailable()) return resume(Effect.succeed(false));
    process.send!(message, (error) => resume(Effect.succeed(error === null)));
  });

const pin = (identity: WorkIdentity, outputRoot: string) =>
  Effect.callback<void>((resume) => {
    if (!privateChannelAvailable()) return resume(Effect.void);
    const cleanup = () => {
      process.off("message", receive);
      process.off("disconnect", disconnect);
    };
    const finish = () => {
      cleanup();
      resume(Effect.void);
    };
    const receive = (message: unknown) => {
      if (
        message !== null &&
        typeof message === "object" &&
        "type" in message &&
        message.type === "work-deliverable-pinned" &&
        "artifactId" in message &&
        message.artifactId === identity.artifactId
      ) {
        finish();
      }
    };
    const disconnect = finish;
    process.on("message", receive);
    process.once("disconnect", disconnect);
    process.send!({ type: "work-deliverable-pin", ...identity, outputRoot }, (error) => {
      if (error) finish();
    });
    return Effect.sync(cleanup);
  }).pipe(Effect.timeoutOption("3 seconds"), Effect.asVoid);

export const prepareWorkDeliverable = Effect.fn("Work.prepareDeliverable")(function* (input: {
  readonly threadId: ThreadId;
  readonly runId: RunId;
  readonly workspace: string;
  readonly scratchRoot: string;
  readonly allowMemo: boolean;
}) {
  if (!privateChannelAvailable()) return undefined;
  const workspace = yield* Effect.tryPromise({
    try: async () => {
      const [workspace, scratchRoot] = await Promise.all([
        NodeFSP.realpath(input.workspace),
        NodeFSP.realpath(input.scratchRoot),
      ]);
      return NodePath.dirname(workspace) === scratchRoot ? workspace : undefined;
    },
    catch: () => undefined,
  }).pipe(Effect.orElseSucceed(() => undefined));
  if (workspace === undefined) return undefined;
  const hasStarterSkill = (name: string) =>
    Effect.tryPromise({
      try: async () =>
        (
          await NodeFSP.lstat(NodePath.join(workspace, ".claude", "skills", name, "SKILL.md"))
        ).isFile(),
      catch: () => undefined,
    }).pipe(Effect.orElseSucceed(() => false));
  const designSkill = (yield* hasStarterSkill("work-design"))
    ? yield* workDesignSkill()
    : undefined;
  const memo = input.allowMemo ? memoRuntime() : undefined;
  const runtime =
    designSkill !== undefined
      ? { kind: "design" as const, skill: designSkill }
      : memo !== undefined && (yield* hasStarterSkill("work-document"))
        ? { kind: "memo" as const, ...memo }
        : undefined;
  if (runtime === undefined) return undefined;
  const identity = {
    threadId: input.threadId,
    runId: input.runId,
    artifactId: NodeCrypto.randomUUID(),
  };
  const outputRoot = NodePath.join(workspace, folderName(identity.artifactId));
  const created = yield* Effect.tryPromise({
    try: () => NodeFSP.mkdir(outputRoot, { mode: 0o700 }),
    catch: () => undefined,
  }).pipe(
    Effect.as(true),
    Effect.orElseSucceed(() => false),
  );
  if (!created) return undefined;
  yield* pin(identity, outputRoot);
  if (runtime.kind === "design") {
    return {
      artifactId: identity.artifactId,
      formats: designFormats,
      context: {
        key: "work_design_output",
        text: [
          runtime.skill,
          "This Design session has a private output slot for this turn. Use it when the user asks to create or revise a design.",
          `Write exactly one editable file, either ${NodePath.join(outputRoot, filenames.html)} or ${NodePath.join(outputRoot, filenames.svg)}. Use the exact absolute path. Preserve earlier copies.`,
        ].join("\n\n"),
      },
    };
  }
  const { python, helper } = runtime;
  const content = NodePath.join(outputRoot, "memo.json");
  return {
    artifactId: identity.artifactId,
    formats: ["docx"] as const,
    context: {
      key: "work_document_output",
      text: [
        "This Word session has a private output slot for this turn. Use it when the user asks to create or revise the document.",
        `Write ${content} with a title and sections. Each section has a heading, optional paragraphs (array of strings), optional page_break (boolean, before this section), and optional table with headers and rows (each cell a string).`,
        "For a two-page memo, start the second page with page_break and keep each page within its margins. Use the attached notes as source material and leave any unspecified owner unassigned.",
        `Run ${shellArg(python)} -I -B ${shellArg(helper)} ${shellArg(content)} ${shellArg(NodePath.join(outputRoot, filenames.docx))}. Use those exact absolute paths even if your terminal starts in a scratchpad. Preserve earlier copies.`,
      ].join("\n"),
    },
  };
});

async function readOutput(workspace: string, artifactId: string, format: WorkDeliverableFormat) {
  const directory = NodePath.join(await NodeFSP.realpath(workspace), folderName(artifactId));
  if ((await NodeFSP.realpath(directory)) !== directory) return undefined;
  const filePath = NodePath.join(directory, filenames[format]);
  const maxBytes = format === "docx" ? WORK_DOCX_MAX_BYTES : designMaxBytes;
  const candidate = await NodeFSP.lstat(filePath);
  if (!candidate.isFile() || candidate.nlink !== 1) return undefined;
  const file = await NodeFSP.open(
    filePath,
    NodeFS.constants.O_RDONLY | NodeFS.constants.O_NOFOLLOW | NodeFS.constants.O_NONBLOCK,
  );
  try {
    const before = await file.stat();
    if (
      !before.isFile() ||
      before.nlink !== 1 ||
      before.ino !== candidate.ino ||
      before.dev !== candidate.dev ||
      before.size <= 0 ||
      before.size > maxBytes
    )
      return undefined;
    const bytes = Buffer.alloc(before.size + 1);
    const { bytesRead } = await file.read({ buffer: bytes, position: 0 });
    const after = await NodeFSP.lstat(filePath);
    if (
      after.dev !== before.dev ||
      after.ino !== before.ino ||
      after.nlink !== 1 ||
      after.size !== before.size ||
      after.ctimeMs !== before.ctimeMs ||
      bytesRead !== before.size
    )
      return undefined;
    return bytes.subarray(0, bytesRead);
  } finally {
    await file.close();
  }
}

// Desktop validates the static markup allowlist on its pinned copy before rendering or placing it.
function isDesignSource(bytes: Buffer, format: "html" | "svg"): boolean {
  const parser = new SaxesParser({ xmlns: true });
  let rootMatches = false;
  let firstTag = true;
  parser.on("opentag", (tag) => {
    if (!firstTag) return;
    firstTag = false;
    rootMatches =
      format === "svg"
        ? tag.local === "svg" && tag.uri === "http://www.w3.org/2000/svg"
        : tag.local === "html" && tag.uri === "";
  });
  parser.on("doctype", () => {
    throw new Error("Unexpected design doctype");
  });
  try {
    const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes).trim();
    const doctype = "<!doctype html>";
    if (format === "html" && source.slice(0, doctype.length).toLowerCase() !== doctype) {
      return false;
    }
    parser.write(format === "html" ? source.slice(doctype.length) : source).close();
    return rootMatches;
  } catch {
    return false;
  }
}

const hasValidWorkDeliverable = Effect.fn("Work.hasValidDeliverable")(function* (
  workspace: string,
  artifactId: string,
  format: WorkDeliverableFormat,
) {
  const bytes = yield* Effect.tryPromise({
    try: () => readOutput(workspace, artifactId, format),
    catch: () => undefined,
  }).pipe(Effect.orElseSucceed(() => undefined));
  if (bytes === undefined) return false;
  return format === "docx" ? yield* validateWorkDocx(bytes) : isDesignSource(bytes, format);
});

export const selectWorkDeliverable = Effect.fn("Work.selectDeliverable")(function* (
  workspace: string,
  output: { readonly artifactId: string; readonly formats: readonly WorkDeliverableFormat[] },
) {
  const formats = yield* Effect.filter(output.formats, (format) =>
    hasValidWorkDeliverable(workspace, output.artifactId, format),
  );
  return formats.length === 1 ? formats[0] : undefined;
});

export const settleWorkDeliverable = Effect.fn("Work.settleDeliverable")(function* (
  identity: WorkIdentity,
  workspace: string,
  format: WorkDeliverableFormat = "docx",
) {
  if (
    !privateChannelAvailable() ||
    !(yield* hasValidWorkDeliverable(workspace, identity.artifactId, format))
  ) {
    return;
  }
  yield* send({
    type: "work-deliverable-settled",
    ...identity,
    result: { path: filenames[format], format, preview: null },
  }).pipe(Effect.timeoutOption("3 seconds"));
});
