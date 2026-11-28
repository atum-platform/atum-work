import { ProviderDriverKind, ProviderInstanceId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  type AutoswitchProvider,
  type ProviderFallbackStateView,
  composerAutoswitchLine,
  defaultConnectedOrder,
  fallbackOrderRows,
  moveInFallbackOrder,
  sessionOverrideFor,
  sessionSwitches,
} from "./providerAutoswitch.logic";

const id = ProviderInstanceId.make;
const provider = (
  instanceId: string,
  driver: string,
  name: string,
  extra: Partial<AutoswitchProvider> = {},
): AutoswitchProvider => ({
  instanceId: id(instanceId),
  driverKind: ProviderDriverKind.make(driver),
  name,
  connected: true,
  isDefault: false,
  ...extra,
});

const chatgpt = provider("codex", "codex", "ChatGPT", { isDefault: true });
const claude = provider("claudeAgent", "claudeAgent", "Claude");
const agy = provider("antigravity", "antigravity", "Antigravity", { connected: false });
const cursor = provider("cursor", "cursor", "Cursor");
const providers = [chatgpt, claude, agy, cursor];

const exhausted = (extra: Partial<ProviderFallbackStateView> = {}): ProviderFallbackStateView => ({
  activeProvider: chatgpt.instanceId,
  preferredProvider: chatgpt.instanceId,
  exhaustedUntil: "2026-11-28T13:37:00.000Z",
  reason: "usage_limit",
  canContinue: false,
  ...extra,
});

describe("settings order", () => {
  it("lists saved plans in order, then other connected plans, then greyed ones, and only switchable drivers", () => {
    const rows = fallbackOrderRows([claude.instanceId], providers);
    expect(rows.map((row) => [row.name, row.connected])).toEqual([
      ["Claude", true],
      ["ChatGPT", true],
      ["Antigravity", false],
    ]);
  });

  it("never keeps a disconnected plan in the saved order", () => {
    const rows = fallbackOrderRows([agy.instanceId, chatgpt.instanceId], providers);
    expect(rows.filter((row) => row.connected).map((row) => row.name)).toEqual([
      "ChatGPT",
      "Claude",
    ]);
    expect(moveInFallbackOrder(rows, claude.instanceId, -1)).toEqual([
      claude.instanceId,
      chatgpt.instanceId,
    ]);
  });

  it("clamps moves at either end and ignores rows that can't move", () => {
    const rows = fallbackOrderRows([], providers);
    const order = rows.filter((row) => row.connected).map((row) => row.instanceId);
    expect(moveInFallbackOrder(rows, chatgpt.instanceId, -1)).toEqual(order);
    expect(moveInFallbackOrder(rows, claude.instanceId, 5)).toEqual(order);
    expect(moveInFallbackOrder(rows, agy.instanceId, -1)).toEqual(order);
  });

  it("starts a new order from connected, switchable plans with the default first", () => {
    const order = defaultConnectedOrder([claude, agy, cursor, chatgpt]);
    expect(order).toEqual([chatgpt.instanceId, claude.instanceId]);
  });
});

describe("session override", () => {
  const account = [chatgpt.instanceId, claude.instanceId];
  const connected = defaultConnectedOrder(providers);

  it("follows the account until the session chooses otherwise", () => {
    expect(sessionSwitches(null, account)).toBe(true);
    expect(sessionSwitches(undefined, [])).toBe(false);
    expect(sessionSwitches([], account)).toBe(false);
    expect(sessionSwitches(account, [])).toBe(true);
  });

  it("saves no override when the choice matches the account, so account changes still apply", () => {
    expect(sessionOverrideFor(true, account, connected)).toBeNull();
    expect(sessionOverrideFor(false, [], connected)).toBeNull();
  });

  it("saves stay as an empty order and switch as the connected order", () => {
    expect(sessionOverrideFor(false, account, connected)).toEqual([]);
    expect(sessionOverrideFor(true, [], connected)).toEqual(connected);
    // Whatever was saved reads back as the choice made.
    expect(sessionSwitches(sessionOverrideFor(false, account, connected), account)).toBe(false);
    expect(sessionSwitches(sessionOverrideFor(true, [], connected), [])).toBe(true);
  });
});

describe("composer line", () => {
  const order = [chatgpt.instanceId, claude.instanceId];
  const line = (state: ProviderFallbackStateView | null, canResume = true, at = order) =>
    composerAutoswitchLine({ state, order: at, providers, canResume });

  it("is silent when the plan answered or after the switch back", () => {
    expect(line(null)).toBeNull();
    expect(line(exhausted({ exhaustedUntil: null, reason: null }))).toBeNull();
  });

  it("names the plan that ran out and the one answering once switched", () => {
    expect(line(exhausted({ activeProvider: claude.instanceId }))).toEqual({
      kind: "switched",
      out: "ChatGPT",
      using: "Claude",
      until: "2026-11-28T13:37:00.000Z",
    });
  });

  it("shows a reset time only with evidence", () => {
    const switched = line(
      exhausted({ activeProvider: claude.instanceId, exhaustedUntil: "unknown" }),
    );
    expect(switched).toMatchObject({ kind: "switched", until: null });
  });

  it("says which plan answers next before the switching turn", () => {
    expect(line(exhausted())).toEqual({
      kind: "next",
      out: "ChatGPT",
      using: "Claude",
      until: "2026-11-28T13:37:00.000Z",
    });
  });

  it("offers Continue only when the engine and the native resume both allow it", () => {
    expect(line(exhausted({ canContinue: true }))).toEqual({
      kind: "continue",
      out: "ChatGPT",
      using: "Claude",
    });
    expect(line(exhausted({ canContinue: true }), false)).toMatchObject({ kind: "next" });
  });

  it("leaves the no-plan-left state to the usage-limit banner", () => {
    expect(line(exhausted(), true, [])).toBeNull();
    expect(line(exhausted(), true, [chatgpt.instanceId, agy.instanceId])).toBeNull();
  });

  it("skips a second instance of the plan that ran out, as the engine does", () => {
    const work = provider("codex-work", "codex", "ChatGPT Work");
    const next = composerAutoswitchLine({
      state: exhausted(),
      order: [work.instanceId, claude.instanceId],
      providers: [...providers, work],
      canResume: true,
    });
    expect(next).toMatchObject({ kind: "next", using: "Claude" });
  });
});
