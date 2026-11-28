import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import { describe, expect, it } from "vite-plus/test";

import { countWorkAttention } from "./attention.logic";

const ENV = "env-1";
const LIVE = new Set([ENV]);

function thread(id: string, overrides: Record<string, unknown> = {}): EnvironmentThreadShell {
  return {
    environmentId: ENV,
    id,
    archivedAt: null,
    lineage: { kind: "root" },
    settledOverride: null,
    hasPendingApprovals: false,
    hasPendingUserInput: false,
    pendingSubagentRequest: null,
    source: { pendingRuntimeRequest: null },
    lastVisitedAt: "2026-11-27T07:00:00.000Z",
    latestRun: { status: "completed", completedAt: "2026-11-27T08:00:00.000Z" },
    ...overrides,
  } as unknown as EnvironmentThreadShell;
}

describe("Work rail attention", () => {
  it("counts a finished thread the person hasn't opened", () => {
    expect(countWorkAttention([thread("a")], LIVE, {})).toEqual({ waiting: 0, finished: 1 });
  });

  it("leaves settled threads out of the unread nudge, as their shelf is folded away", () => {
    const settled = thread("relay", { settledOverride: "settled" });
    expect(countWorkAttention([settled], LIVE, {})).toEqual({ waiting: 0, finished: 0 });
    const reopened = thread("relay", { settledOverride: "active" });
    expect(countWorkAttention([reopened], LIVE, {})).toEqual({ waiting: 0, finished: 1 });
  });

  it("still counts a settled thread that asks for an approval", () => {
    const asking = thread("ask", { settledOverride: "settled", hasPendingApprovals: true });
    expect(countWorkAttention([asking], LIVE, {})).toEqual({ waiting: 1, finished: 0 });
  });

  it("ignores seen, archived and offline threads", () => {
    const seen = thread("seen", { lastVisitedAt: "2026-11-27T09:00:00.000Z" });
    const archived = thread("gone", { archivedAt: "2026-11-27T09:00:00.000Z" });
    const offline = thread("far", { environmentId: "env-2" });
    expect(countWorkAttention([seen, archived, offline], LIVE, {})).toEqual({
      waiting: 0,
      finished: 0,
    });
  });
});
