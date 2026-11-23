import type { ProviderApprovalDecision, ProviderApprovalOption } from "@t3tools/contracts";

export type WorkFileKind = "document" | "image" | "sheet" | "file";

const KIND_BY_EXTENSION: Record<string, WorkFileKind> = {
  md: "document",
  markdown: "document",
  txt: "document",
  doc: "document",
  docx: "document",
  rtf: "document",
  pdf: "document",
  pages: "document",
  html: "document",
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  webp: "image",
  svg: "image",
  heic: "image",
  csv: "sheet",
  tsv: "sheet",
  xls: "sheet",
  xlsx: "sheet",
  numbers: "sheet",
};

export function workFileKind(path: string): WorkFileKind {
  const name = path.split(/[/\\]/).at(-1) ?? path;
  const dot = name.lastIndexOf(".");
  return dot > 0 ? (KIND_BY_EXTENSION[name.slice(dot + 1).toLowerCase()] ?? "file") : "file";
}

/**
 * The two answers Work offers. Absent options mean the provider takes T3's defaults; a provider
 * whose own options have no plain allow/decline pair keeps T3's full action row instead.
 */
export function workApprovalChoices(
  options: ReadonlyArray<ProviderApprovalOption> | undefined,
): { allow: ProviderApprovalDecision; decline: ProviderApprovalDecision } | null {
  if (options === undefined) return { allow: "accept", decline: "decline" };
  const decisions = new Set(options.map((option) => option.decision));
  if (!decisions.has("accept")) return null;
  const decline = decisions.has("decline") ? "decline" : decisions.has("cancel") ? "cancel" : null;
  return decline ? { allow: "accept", decline } : null;
}
