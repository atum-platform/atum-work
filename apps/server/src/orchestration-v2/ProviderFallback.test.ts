import {
  DEFAULT_SERVER_SETTINGS,
  ProjectId,
  ProviderDriverKind,
  ProviderInstanceId,
  type OrchestrationV2AppThread,
  type ServerProvider,
  type ServerProviderUsageWindow,
} from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { quotaExhaustedUntil, workFallbackOrder } from "./ProviderFallback.ts";

const codex = ProviderInstanceId.make("codex");
const claude = ProviderInstanceId.make("claudeAgent");
const projectId = ProjectId.make("fallback-work");
const thread = {
  projectId,
  creationSource: "web",
  lineage: { relationshipToParent: null },
} as Pick<OrchestrationV2AppThread, "projectId" | "creationSource" | "lineage">;

const checkedAt = "2026-11-28T09:00:00.000Z";
const laterCheck = "2026-11-28T09:10:00.000Z";
const firstReset = "2026-11-28T10:00:00.000Z";
const secondReset = "2026-11-29T01:00:00.000Z";
const window = (id: string, values: Partial<ServerProviderUsageWindow>) =>
  ({
    id,
    kind: "other",
    label: id,
    usedPercent: 100,
    ...values,
  }) satisfies ServerProviderUsageWindow;

const provider = (
  windows: ReadonlyArray<ServerProviderUsageWindow>,
  usageCheckedAt = checkedAt,
  driver = "codex",
): ServerProvider => ({
  instanceId: codex,
  driver: ProviderDriverKind.make(driver),
  enabled: true,
  installed: true,
  version: null,
  status: "ready",
  auth: { status: "authenticated" },
  checkedAt,
  models: [],
  slashCommands: [],
  skills: [],
  usageLimits: { checkedAt: usageCheckedAt, windows },
});

describe("Work provider fallback settings", () => {
  it("inherits the account order, supports an override, and allows an explicit opt-out", () => {
    const settings = { ...DEFAULT_SERVER_SETTINGS, providerFallbackOrder: [claude, codex] };
    expect(workFallbackOrder(DEFAULT_SERVER_SETTINGS, thread)).toEqual([]);
    expect(workFallbackOrder(settings, thread)).toEqual([claude, codex]);
    expect(workFallbackOrder(settings, { ...thread, providerFallbackOrder: null })).toEqual([
      claude,
      codex,
    ]);
    expect(workFallbackOrder(settings, { ...thread, providerFallbackOrder: [codex] })).toEqual([
      codex,
    ]);
    expect(workFallbackOrder(settings, { ...thread, providerFallbackOrder: [] })).toEqual([]);
    const codeSettings = {
      ...settings,
      projectSettingsOverrides: { [projectId]: { atumSurfaceMode: "code" as const } },
    };
    expect(workFallbackOrder(codeSettings, thread)).toEqual([]);
  });
});

describe("Work provider quota evidence", () => {
  it("keeps the latest applicable reset and ignores an unrelated exhausted model", () => {
    const snapshot = provider([
      window("primary", { resetsAt: firstReset }),
      window("secondary", { resetsAt: secondReset }),
      window("other-model", { modelIds: ["different"], resetsAt: "2026-12-01T00:00:00.000Z" }),
    ]);
    expect(quotaExhaustedUntil(snapshot, "gpt-5.4", undefined, Date.parse(laterCheck))).toBe(
      secondReset,
    );
    expect(quotaExhaustedUntil(snapshot, "gpt-5.4", undefined, Date.parse(secondReset))).toBeNull();
  });

  it("requires newer matching quota evidence for an unknown reset", () => {
    const failure = { resetAt: null, observedAt: checkedAt };
    const old = provider([window("primary", { usedPercent: 30, resetsAt: firstReset })]);
    const unrelated = provider(
      [window("other", { modelIds: ["different"], usedPercent: 20 })],
      laterCheck,
    );
    const fresh = provider(
      [window("primary", { usedPercent: 30, resetsAt: firstReset })],
      laterCheck,
    );
    const probeFailed: ServerProvider = {
      ...fresh,
      usageLimits: { ...fresh.usageLimits!, unavailable: { reason: "probeFailed" } },
    };
    expect(quotaExhaustedUntil(old, "gpt-5.4", failure, Date.parse(laterCheck))).toBe("unknown");
    expect(quotaExhaustedUntil(unrelated, "gpt-5.4", failure, Date.parse(laterCheck))).toBe(
      "unknown",
    );
    expect(quotaExhaustedUntil(probeFailed, "gpt-5.4", failure, Date.parse(laterCheck))).toBe(
      "unknown",
    );
    expect(quotaExhaustedUntil(fresh, "gpt-5.4", failure, Date.parse(laterCheck))).toBeNull();
  });

  it("uses Go quota for Go selections only", () => {
    const snapshot = provider(
      [window("go_session", { resetsAt: firstReset })],
      checkedAt,
      "opencode",
    );
    expect(
      quotaExhaustedUntil(snapshot, "opencode-go/deepseek", undefined, Date.parse(laterCheck)),
    ).toBe(firstReset);
    expect(
      quotaExhaustedUntil(snapshot, "console-anthropic/claude", undefined, Date.parse(laterCheck)),
    ).toBeNull();
  });
});
