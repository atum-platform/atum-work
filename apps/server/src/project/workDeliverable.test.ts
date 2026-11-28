// @effect-diagnostics nodeBuiltinImport:off -- Exercise real filesystem boundaries and build a small ZIP fixture.
import * as NodeFSP from "node:fs/promises";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeZlib from "node:zlib";
import { it } from "@effect/vitest";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as HostProcess from "@t3tools/shared/HostProcess";
import { RunId, ThreadId } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { expect, vi } from "vite-plus/test";
import {
  prepareWorkDeliverable,
  selectWorkDeliverable,
  settleWorkDeliverable,
} from "./workDeliverable.ts";
import { validateWorkDocx, WORK_DOCX_MAX_BYTES } from "./workDocx.ts";
import { prepareWorkStarter } from "./workStarter.ts";

const wordNamespace = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const editableBody = "<w:p><w:r><w:t>Weekly pilot memo</w:t></w:r></w:p>";

function memoZip(body: string) {
  const parts = {
    "[Content_Types].xml":
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    "_rels/.rels":
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    "word/document.xml": `<w:document xmlns:w="${wordNamespace}"><w:body>${body}</w:body></w:document>`,
  };
  const files: Buffer[] = [];
  const directory: Buffer[] = [];
  let offset = 0;
  for (const [path, xml] of Object.entries(parts)) {
    const name = Buffer.from(path);
    const data = Buffer.from(xml);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(NodeZlib.crc32(data), 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50);
    local.copy(central, 6, 4, 28);
    central.writeUInt32LE(offset, 42);
    files.push(local, name, data);
    directory.push(central, name);
    offset += local.length + name.length + data.length;
  }
  const central = Buffer.concat(directory);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(directory.length / 2, 8);
  end.writeUInt16LE(directory.length / 2, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...files, central, end]);
}

it.effect("a DOCX needs well-formed Word XML with editable text", () =>
  Effect.gen(function* () {
    const valid = memoZip(editableBody);
    expect(yield* validateWorkDocx(valid)).toBe(true);
    expect(yield* validateWorkDocx(memoZip("<w:p/>"))).toBe(false);
    expect(yield* validateWorkDocx(memoZip("<w:p>"))).toBe(false);
    expect(yield* validateWorkDocx(memoZip(editableBody + "<w:altChunk/>"))).toBe(false);
    expect(yield* validateWorkDocx(Buffer.from("Memo.docx"))).toBe(false);
  }),
);

it.effect(
  "pins only Word Scratch output and emits a bounded regular DOCX over the inherited host channel",
  () =>
    Effect.gen(function* () {
      const platform = yield* HostProcess.Platform;
      const root = yield* Effect.promise(() =>
        NodeFSP.mkdtemp(NodePath.join(NodeOS.tmpdir(), "work-docx-")),
      );
      const scratchRoot = NodePath.join(root, "scratch");
      const workspace = NodePath.join(scratchRoot, "memo");
      const skill = NodePath.join(workspace, ".claude", "skills", "work-document");
      const run = { threadId: ThreadId.make("thread"), runId: RunId.make("run") };
      const processFields = ["connected", "send"] as const;
      const originals = processFields.map((key) => Object.getOwnPropertyDescriptor(process, key));
      const send = vi.fn(
        (message: { type: string; artifactId: string }, cb: (error: null) => void) => {
          if (message.type === "work-deliverable-pin") {
            process.emit(
              "message",
              { type: "work-deliverable-pinned", artifactId: message.artifactId, accepted: false },
              undefined,
            );
          }
          cb(null);
          return true;
        },
      );
      try {
        Object.defineProperty(process, "connected", { configurable: true, value: true });
        Object.defineProperty(process, "send", { configurable: true, value: send });
        vi.stubEnv("ATUM_WORK_MEMO_PYTHON", NodePath.join(root, "python"));
        vi.stubEnv("ATUM_WORK_MEMO_SCRIPT", NodePath.join(root, "memo.py"));
        yield* Effect.promise(() => NodeFSP.mkdir(skill, { recursive: true }));
        const prepare = () =>
          prepareWorkDeliverable({ ...run, workspace, scratchRoot, allowMemo: true });
        expect(yield* prepare()).toBeUndefined();
        yield* Effect.promise(() =>
          NodeFSP.writeFile(NodePath.join(skill, "SKILL.md"), "Write Word documents."),
        );
        const pinned = yield* prepare();
        expect(pinned).toBeDefined();
        if (!pinned) throw new Error("Expected a pinned output slot");
        const identity = { ...run, artifactId: pinned.artifactId };
        const canonicalWorkspace = yield* Effect.promise(() => NodeFSP.realpath(workspace));
        const directory = NodePath.join(canonicalWorkspace, `.work-output-${pinned.artifactId}`);
        const docx = NodePath.join(directory, "Memo.docx");
        expect(send.mock.calls.at(-1)?.[0]).toEqual({
          type: "work-deliverable-pin",
          ...identity,
          outputRoot: directory,
        });
        if (platform !== "win32") {
          const stat = yield* Effect.promise(() => NodeFSP.lstat(directory));
          expect(stat.mode & 0o777).toBe(0o700);
        }
        const settle = () => settleWorkDeliverable(identity, workspace);
        yield* Effect.promise(() =>
          NodeFSP.writeFile(NodePath.join(workspace, "Memo.docx"), memoZip(editableBody)),
        );
        yield* settle();
        if (platform !== "win32") {
          yield* Effect.promise(() => NodeFSP.symlink(NodePath.join(workspace, "Memo.docx"), docx));
          yield* settle();
          yield* Effect.promise(() => NodeFSP.rm(docx));
        }
        yield* Effect.promise(() => NodeFSP.writeFile(docx, memoZip("<w:p/>")));
        yield* settle();
        yield* Effect.promise(() => NodeFSP.truncate(docx, WORK_DOCX_MAX_BYTES + 1));
        yield* settle();
        expect(send).toHaveBeenCalledTimes(1);
        yield* Effect.promise(() => NodeFSP.writeFile(docx, memoZip(editableBody)));
        yield* settle();
        expect(send.mock.calls.at(-1)?.[0]).toEqual({
          type: "work-deliverable-settled",
          ...identity,
          result: { path: "Memo.docx", format: "docx", preview: null },
        });
      } finally {
        vi.unstubAllEnvs();
        for (const [index, key] of processFields.entries()) {
          const original = originals[index];
          if (original) Object.defineProperty(process, key, original);
          else Reflect.deleteProperty(process, key);
        }
        yield* Effect.promise(() => NodeFSP.rm(root, { recursive: true, force: true }));
      }
    }),
);

const designs = {
  html: '<!doctype html><html><head><meta charset="utf-8" /></head><body><h1>Draft&nbsp;flyer &mdash; Saturday</h1></body></html>',
  svg: '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="320"><text x="20" y="40">Draft diagram</text></svg>',
};

it.effect("installs the host design guidance once and points other providers to it", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const root = yield* fs.makeTempDirectoryScoped({ prefix: "work-design-starter-" });
    const staged = NodePath.join(root, "SKILL.md");
    const workspace = NodePath.join(root, "design");
    const skill = "Use editable markup and system fonts.";
    yield* fs.writeFileString(staged, skill);
    vi.stubEnv("ATUM_WORK_DESIGN_SKILL", staged);
    try {
      yield* prepareWorkStarter(workspace, "svg");
      expect(
        yield* fs.readFileString(NodePath.join(workspace, ".claude/skills/work-design/SKILL.md")),
      ).toBe(skill);
      expect(yield* fs.exists(NodePath.join(workspace, ".agents"))).toBe(false);
      expect(yield* fs.readFileString(NodePath.join(workspace, "AGENTS.md"))).toContain(
        ".claude/skills/work-design/SKILL.md",
      );
    } finally {
      vi.unstubAllEnvs();
    }
  }).pipe(Effect.provide(NodeServices.layer)),
);

it.effect.each(["html", "svg"] as const)(
  "settles one editable %s and preserves the first output on same-thread revision",
  (format) =>
    Effect.gen(function* () {
      const platform = yield* HostProcess.Platform;
      const root = yield* Effect.promise(() =>
        NodeFSP.mkdtemp(NodePath.join(NodeOS.tmpdir(), "work-design-")),
      );
      const scratchRoot = NodePath.join(root, "scratch");
      const workspace = NodePath.join(scratchRoot, "design");
      const starter = NodePath.join(workspace, ".claude", "skills", "work-design");
      const staged = NodePath.join(root, "SKILL.md");
      const threadId = ThreadId.make("design-thread");
      const fields = ["connected", "send"] as const;
      const originals = fields.map((key) => Object.getOwnPropertyDescriptor(process, key));
      const send = vi.fn(
        (message: { type: string; artifactId: string }, cb: (error: null) => void) => {
          if (message.type === "work-deliverable-pin") {
            process.emit(
              "message",
              { type: "work-deliverable-pinned", artifactId: message.artifactId, accepted: true },
              undefined,
            );
          }
          cb(null);
          return true;
        },
      );
      try {
        Object.defineProperty(process, "connected", { configurable: true, value: true });
        Object.defineProperty(process, "send", { configurable: true, value: send });
        vi.stubEnv("ATUM_WORK_MEMO_PYTHON", undefined);
        vi.stubEnv("ATUM_WORK_MEMO_SCRIPT", undefined);
        vi.stubEnv("ATUM_WORK_DESIGN_SKILL", staged);
        yield* Effect.promise(async () => {
          await NodeFSP.mkdir(starter, { recursive: true });
          await NodeFSP.writeFile(NodePath.join(starter, "SKILL.md"), "Existing Design starter.");
        });
        const prepare = (runId: RunId) =>
          prepareWorkDeliverable({
            threadId,
            runId,
            workspace,
            scratchRoot,
            allowMemo: false,
          });
        const runId = RunId.make("first");
        expect(yield* prepare(runId)).toBeUndefined();
        yield* Effect.promise(() =>
          NodeFSP.writeFile(staged, "Use editable markup and system fonts."),
        );
        const output = yield* prepare(runId);
        if (!output) throw new Error("Expected a pinned design output");
        expect(output.context.text).not.toContain("Use editable markup and system fonts.");
        expect(output.context.text.split("\n")).toHaveLength(1);
        const canonicalWorkspace = yield* Effect.promise(() => NodeFSP.realpath(workspace));
        const slot = (artifactId: string) =>
          NodePath.join(canonicalWorkspace, `.work-output-${artifactId}`);
        const outputRoot = slot(output.artifactId);
        const identity = { threadId, runId, artifactId: output.artifactId };
        const filename = `Design.${format}`;
        const source = NodePath.join(outputRoot, filename);
        const otherFormat = format === "html" ? "svg" : "html";
        const alternate = NodePath.join(outputRoot, `Design.${otherFormat}`);
        expect(output.context.text).toContain(source);
        expect(output.context.text).toContain(alternate);
        expect(send).toHaveBeenLastCalledWith(
          { type: "work-deliverable-pin", ...identity, outputRoot },
          expect.any(Function),
        );
        const settle = () => settleWorkDeliverable(identity, workspace, format);
        yield* Effect.promise(() =>
          NodeFSP.writeFile(NodePath.join(workspace, filename), designs[format]),
        );
        expect(yield* selectWorkDeliverable(workspace, output)).toBeUndefined();
        yield* settle();
        if (platform !== "win32") {
          yield* Effect.promise(() => NodeFSP.symlink(NodePath.join(workspace, filename), source));
          yield* settle();
          yield* Effect.promise(() => NodeFSP.unlink(source));
        }
        yield* Effect.promise(() => NodeFSP.writeFile(source, ""));
        yield* settle();
        yield* Effect.promise(() => NodeFSP.truncate(source, 512 * 1024 + 1));
        yield* settle();
        expect(send).toHaveBeenCalledTimes(1);
        yield* Effect.promise(() => NodeFSP.writeFile(source, "Desktop validates these bytes."));
        expect(yield* selectWorkDeliverable(workspace, output)).toBe(format);
        yield* settle();
        expect(send.mock.calls.at(-1)?.[0]).toMatchObject({
          type: "work-deliverable-settled",
          result: { path: filename, format },
        });
        yield* Effect.promise(async () => {
          await NodeFSP.writeFile(source, designs[format]);
          await NodeFSP.writeFile(alternate, designs[otherFormat]);
        });
        expect(yield* selectWorkDeliverable(workspace, output)).toBeUndefined();
        yield* Effect.promise(() => NodeFSP.unlink(alternate));
        expect(yield* selectWorkDeliverable(workspace, output)).toBe(format);
        yield* settle();
        expect(send).toHaveBeenLastCalledWith(
          {
            type: "work-deliverable-settled",
            ...identity,
            result: { path: filename, format, preview: null },
          },
          expect.any(Function),
        );

        const revisionRunId = RunId.make("revision");
        const revision = yield* prepare(revisionRunId);
        if (!revision) throw new Error("Expected a revision output slot");
        expect(revision.artifactId).not.toBe(output.artifactId);
        const revisedSource = NodePath.join(slot(revision.artifactId), filename);
        yield* Effect.promise(() =>
          NodeFSP.writeFile(revisedSource, designs[format].replace("Draft", "Final")),
        );
        expect(yield* selectWorkDeliverable(workspace, revision)).toBe(format);
        yield* settleWorkDeliverable(
          { threadId, runId: revisionRunId, artifactId: revision.artifactId },
          workspace,
          format,
        );
        expect(send.mock.calls.at(-1)?.[0]).toMatchObject({
          runId: revisionRunId,
          artifactId: revision.artifactId,
        });
        expect(yield* Effect.promise(() => NodeFSP.readFile(source, "utf8"))).toBe(designs[format]);
      } finally {
        vi.unstubAllEnvs();
        for (const [index, key] of fields.entries()) {
          const original = originals[index];
          if (original) Object.defineProperty(process, key, original);
          else Reflect.deleteProperty(process, key);
        }
        yield* Effect.promise(() => NodeFSP.rm(root, { recursive: true, force: true }));
      }
    }),
);
