import { describe, expect, it, vi } from "vite-plus/test";

import { checkWorkSubmitAccess, readWorkProtonsAction } from "./workSubmitAccess";

describe("Work submit access", () => {
  it("does not read access for another provider", () => {
    const readModelAccess = vi.fn();
    expect(checkWorkSubmitAccess(["codex"], { readModelAccess })).toBeUndefined();
    expect(readModelAccess).not.toHaveBeenCalled();
  });

  it("reads once for a selection that includes the managed provider", async () => {
    const readModelAccess = vi.fn(async () => "allowed" as const);
    await expect(
      checkWorkSubmitAccess(["codex", "atum-managed", "atum-managed"], { readModelAccess }),
    ).resolves.toBeNull();
    expect(readModelAccess).toHaveBeenCalledOnce();
  });

  it("refuses an empty balance and fails closed if the bridge cannot answer", async () => {
    const denied = await checkWorkSubmitAccess(["atum-managed"], {
      readModelAccess: async () => "empty",
    });
    const offline = await checkWorkSubmitAccess(["atum-managed"], {
      readModelAccess: async () => {
        throw new Error("offline");
      },
    });
    expect(denied).toBeTruthy();
    expect(offline).toBeTruthy();
    expect(offline).not.toEqual(denied);
    await expect(checkWorkSubmitAccess(["atum-managed"], undefined)).resolves.toBe(offline);
  });
});

describe("Work out-of-Protons action", () => {
  const readModelAccess = async () => "empty" as const;
  const refusal = async (bridge: Parameters<typeof checkWorkSubmitAccess>[1]) =>
    (await checkWorkSubmitAccess(["atum-managed"], bridge)) ?? null;

  it("offers the top-up action only for the out-of-Protons line", async () => {
    const openProtons = vi.fn(async () => true);
    const bridge = { readModelAccess, openProtons };
    const denied = await refusal(bridge);
    const offline = await refusal(undefined);

    expect(readWorkProtonsAction(offline, bridge)).toBeNull();
    expect(readWorkProtonsAction("Turn failed", bridge)).toBeNull();
    expect(readWorkProtonsAction(null, bridge)).toBeNull();

    const action = readWorkProtonsAction(denied, bridge);
    expect(action).toBeTypeOf("function");
    action?.();
    expect(openProtons).toHaveBeenCalledOnce();
  });

  it("shows no action when the bridge cannot open the top-up page", async () => {
    const denied = await refusal({ readModelAccess });
    expect(readWorkProtonsAction(denied, { readModelAccess })).toBeNull();
    expect(readWorkProtonsAction(denied, undefined)).toBeNull();
  });

  it("swallows a rejected open so the click never throws", async () => {
    const openProtons = vi.fn(async () => {
      throw new Error("closed");
    });
    const denied = await refusal({ readModelAccess });
    expect(() => readWorkProtonsAction(denied, { readModelAccess, openProtons })?.()).not.toThrow();
    await vi.waitFor(() => expect(openProtons).toHaveBeenCalledOnce());
  });
});
