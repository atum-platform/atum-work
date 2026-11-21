import { describe, expect, it, vi } from "vite-plus/test";

import { checkWorkSubmitAccess } from "./workSubmitAccess";

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
