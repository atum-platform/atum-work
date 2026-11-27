import * as NodeZlib from "node:zlib";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { openZipArchive } from "../zipArchive.ts";
import { SaxesParser, type SaxesTagNS } from "saxes";

export const WORK_DOCX_MAX_BYTES = 8 * 1024 * 1024;
const WORD = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const TYPES = "http://schemas.openxmlformats.org/package/2006/content-types";
const RELS = "http://schemas.openxmlformats.org/package/2006/relationships";
const OFFICE_DOCUMENT =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument";
const MAIN_PART =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml";

function inspectXml(bytes: Buffer, validate: (parser: SaxesParser<{ xmlns: true }>) => void) {
  const parser = new SaxesParser({ xmlns: true });
  parser.on("doctype", () => {
    throw new Error("DTD in DOCX");
  });
  validate(parser);
  parser.write(new TextDecoder("utf-8", { fatal: true }).decode(bytes)).close();
}

const isTag = (tag: SaxesTagNS, uri: string, local: string) =>
  tag.uri === uri && tag.local === local;

const attr = (tag: SaxesTagNS, name: string) => tag.attributes[name]?.value;

class InvalidDocx extends Schema.TaggedError<InvalidDocx>()("InvalidDocx", {}) {}

export const validateWorkDocx = Effect.fn("Work.validateDocx")(function* (bytes: Buffer) {
  const archiveError = () => new InvalidDocx();
  if (bytes.length === 0 || bytes.length > WORK_DOCX_MAX_BYTES) return false;
  return yield* Effect.scoped(
    Effect.gen(function* () {
      const archive = yield* openZipArchive(bytes, archiveError);
      if (archive.entryCount > 24) return false;
      const names = new Set<string>();
      let expanded = 0;
      let contentType = false;
      let documentRelationship = false;
      let editable = false;
      for (let entry = yield* archive.next; entry !== null; entry = yield* archive.next) {
        const name = entry.fileName;
        expanded += entry.uncompressedSize;
        if (
          names.has(name) ||
          expanded > 8 * WORK_DOCX_MAX_BYTES ||
          entry.uncompressedSize > WORK_DOCX_MAX_BYTES ||
          /(?:vbaProject|activeX|embeddings)\b/iu.test(name)
        )
          return false;
        names.add(name);
        const xml = yield* Effect.scoped(
          Effect.gen(function* () {
            const stream = yield* archive.streamEntry(entry);
            return yield* Effect.tryPromise({
              try: async () => {
                const chunks: Buffer[] = [];
                for await (const chunk of stream) chunks.push(Buffer.from(chunk));
                return Buffer.concat(chunks, entry.uncompressedSize);
              },
              catch: archiveError,
            });
          }),
        );
        if (NodeZlib.crc32(xml) !== entry.crc32) return false;
        if (!name.endsWith(".xml") && !name.endsWith(".rels")) continue;
        yield* Effect.try({
          try: () =>
            inspectXml(xml, (parser) => {
              let depth = 0;
              let body = false;
              let text = false;
              parser.on("opentag", (tag) => {
                depth++;
                if (name === "[Content_Types].xml") {
                  if (depth === 1 && !isTag(tag, TYPES, "Types")) throw archiveError();
                  if (depth === 2 && isTag(tag, TYPES, "Override")) {
                    contentType ||=
                      attr(tag, "PartName") === "/word/document.xml" &&
                      attr(tag, "ContentType") === MAIN_PART;
                  }
                } else if (name.endsWith(".rels")) {
                  if (depth === 1 && !isTag(tag, RELS, "Relationships")) throw archiveError();
                  if (isTag(tag, RELS, "Relationship")) {
                    if (
                      (attr(tag, "TargetMode") ?? "Internal") !== "Internal" ||
                      /[:\\%]/u.test(attr(tag, "Target") ?? "")
                    )
                      throw archiveError();
                    if (name === "_rels/.rels" && attr(tag, "Type") === OFFICE_DOCUMENT) {
                      if (documentRelationship || attr(tag, "Target") !== "word/document.xml") {
                        throw archiveError();
                      }
                      documentRelationship = true;
                    }
                  }
                } else if (name === "word/document.xml") {
                  if (depth === 1 && !isTag(tag, WORD, "document")) throw archiveError();
                  if (
                    tag.uri === WORD &&
                    ["fldSimple", "instrText", "delInstrText", "object", "altChunk"].includes(
                      tag.local,
                    )
                  )
                    throw archiveError();
                  if (depth === 2) body = isTag(tag, WORD, "body");
                  text = body && isTag(tag, WORD, "t");
                }
              });
              parser.on("text", (value) => {
                editable ||= text && value.trim().length > 0;
              });
              parser.on("closetag", () => {
                if (depth-- === 2) body = false;
                text = false;
              });
            }),
          catch: archiveError,
        });
      }
      return contentType && documentRelationship && editable;
    }),
  ).pipe(Effect.orElseSucceed(() => false));
});
