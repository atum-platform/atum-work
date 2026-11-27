// @effect-diagnostics nodeBuiltinImport:off -- Inspect the run-local file with a no-follow descriptor.
import * as NodeCrypto from "node:crypto";
import * as NodeFS from "node:fs";
import * as NodeFSP from "node:fs/promises";
import * as NodePath from "node:path";
import type { RunId, ThreadId } from "@t3tools/contracts";
import * as Effect from "effect/Effect";

import { validateWorkDocx, WORK_DOCX_MAX_BYTES } from "./workDocx.ts";

const filename = "Memo.docx";
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
export const workDeliverablesEnabled = () => memoRuntime() !== undefined;

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
}) {
  const runtime = memoRuntime();
  if (runtime === undefined) return undefined;
  const { python, helper } = runtime;
  const identity = {
    threadId: input.threadId,
    runId: input.runId,
    artifactId: NodeCrypto.randomUUID(),
  };
  const outputRoot = yield* Effect.tryPromise({
    try: async () => {
      const [workspace, scratchRoot] = await Promise.all([
        NodeFSP.realpath(input.workspace),
        NodeFSP.realpath(input.scratchRoot),
      ]);
      if (NodePath.dirname(workspace) !== scratchRoot) return undefined;
      const skill = await NodeFSP.lstat(
        NodePath.join(workspace, ".claude", "skills", "work-document", "SKILL.md"),
      );
      if (!skill.isFile()) return undefined;
      const directory = NodePath.join(workspace, folderName(identity.artifactId));
      await NodeFSP.mkdir(directory, { mode: 0o700 });
      return directory;
    },
    catch: () => undefined,
  }).pipe(Effect.orElseSucceed(() => undefined));
  if (outputRoot === undefined) return undefined;
  yield* pin(identity, outputRoot);
  const content = NodePath.join(outputRoot, "memo.json");
  return {
    artifactId: identity.artifactId,
    context: {
      key: "work_document_output",
      text: [
        "This Word session has a private output slot for this turn. Use it when the user asks to create or revise the document.",
        `Write ${content} with a title and sections. Each section has a heading, optional paragraphs (array of strings), optional page_break (boolean, before this section), and optional table with headers and rows (each cell a string).`,
        "For a two-page memo, start the second page with page_break and keep each page within its margins. Use the attached notes as source material and leave any unspecified owner unassigned.",
        `Run ${shellArg(python)} -I -B ${shellArg(helper)} ${shellArg(content)} ${shellArg(NodePath.join(outputRoot, filename))}. Use those exact absolute paths even if your terminal starts in a scratchpad. Preserve earlier copies.`,
      ].join("\n"),
    },
  };
});

async function readMemo(workspace: string, artifactId: string) {
  const directory = NodePath.join(await NodeFSP.realpath(workspace), folderName(artifactId));
  if ((await NodeFSP.realpath(directory)) !== directory) return undefined;
  const filePath = NodePath.join(directory, filename);
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
      before.size > WORK_DOCX_MAX_BYTES
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

export const hasValidWorkDeliverable = Effect.fn("Work.hasValidDeliverable")(function* (
  workspace: string,
  artifactId: string,
) {
  const bytes = yield* Effect.tryPromise({
    try: () => readMemo(workspace, artifactId),
    catch: () => undefined,
  }).pipe(Effect.orElseSucceed(() => undefined));
  return bytes !== undefined && (yield* validateWorkDocx(bytes));
});

export const settleWorkDeliverable = Effect.fn("Work.settleDeliverable")(function* (
  identity: WorkIdentity,
  workspace: string,
) {
  if (
    !privateChannelAvailable() ||
    !(yield* hasValidWorkDeliverable(workspace, identity.artifactId))
  ) {
    return;
  }
  yield* send({
    type: "work-deliverable-settled",
    ...identity,
    result: { path: filename, format: "docx", preview: null },
  }).pipe(Effect.timeoutOption("3 seconds"));
});
