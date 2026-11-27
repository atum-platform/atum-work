import { describe, expect, it } from "vite-plus/test";

import { isWorkModeHiddenSurface, workModeDisabledShortcuts } from "./surfaceMode.logic";
import { workApprovalChoices, workFileKind } from "./WorkPresentation.logic";

describe("Work mode", () => {
  it("hides only source-control and terminal surfaces, and only in Work", () => {
    for (const kind of ["diff", "terminal", "pull-request", "pull-requests", "issue"] as const) {
      expect(isWorkModeHiddenSurface(true, { kind })).toBe(true);
      expect(isWorkModeHiddenSurface(false, { kind })).toBe(false);
    }
    for (const kind of ["files", "file", "preview", "device", "linked-thread"] as const) {
      expect(isWorkModeHiddenSurface(true, { kind })).toBe(false);
    }
  });

  it("answers every terminal chord as unhandled", () => {
    const disabled = workModeDisabledShortcuts({
      "terminal.toggle": () => {},
      "terminal.new": () => {},
    });
    expect(Object.keys(disabled)).toEqual(["terminal.toggle", "terminal.new"]);
    expect(Object.values(disabled).map((run) => run())).toEqual([false, false]);
  });

  it("offers Allow / Not now only when the provider has a plain pair", () => {
    expect(workApprovalChoices(undefined)).toEqual({ allow: "accept", decline: "decline" });
    expect(
      workApprovalChoices([
        { decision: "accept", label: "Yes" },
        { decision: "cancel", label: "Stop" },
      ]),
    ).toEqual({ allow: "accept", decline: "cancel" });
    expect(workApprovalChoices([{ decision: "acceptForSession", label: "Always" }])).toBeNull();
  });

  it("names a changed file by what it is, not by its code", () => {
    expect(workFileKind("Documents/Q4 summary.DOCX")).toBe("document");
    expect(workFileKind("shots\\hero.png")).toBe("image");
    expect(workFileKind("budget.csv")).toBe("sheet");
    expect(workFileKind(".env")).toBe("file");
  });
});
