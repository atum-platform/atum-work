import { describe, expect, it, vi } from "vite-plus/test";

import { createModelSelection } from "@t3tools/shared/model";
import { ProviderInstanceId } from "@t3tools/contracts";
import {
  checkWorkSubmitAccess,
  readWorkProtonsAction,
  submitWorkLearning,
} from "./workSubmitAccess";

describe("Work composer handoff", () => {
  const input = {
    threadId: "draft",
    requestId: "send",
    text: "Remember this format.",
    modelSelection: createModelSelection(ProviderInstanceId.make("codex"), "fixture"),
  };
  const context = { work: true, draft: true, textOnly: true };
  const readModelAccess = async () => "allowed" as const;

  it("relays a new draft with the selected provider", async () => {
    const submitLearning = vi.fn(async () => ({
      status: "started" as const,
      threadId: "work-learning-session",
    }));
    await expect(
      submitWorkLearning(input, context, { readModelAccess, submitLearning }),
    ).resolves.toEqual({ status: "started", threadId: "work-learning-session" });
    expect(submitLearning).toHaveBeenCalledExactlyOnceWith(input);
  });

  it("keeps existing local and offline assistant threads usable", async () => {
    const submitLearning = vi.fn(async () => ({ status: "standalone" as const }));
    const bridge = { readModelAccess, submitLearning };
    await expect(submitWorkLearning(input, context, bridge)).resolves.toEqual({
      status: "standalone",
    });
    await expect(
      submitWorkLearning({ ...input, threadId: "work-learning-session" }, context, bridge),
    ).resolves.toEqual({ status: "standalone" });
    // A completed document supplies no reason to route the existing thread.
    const localDocumentThread = { ...input, document: { artifactId: "completed-docx" } };
    expect(
      submitWorkLearning(localDocumentThread, { ...context, draft: false }, bridge),
    ).toBeUndefined();
    expect(submitLearning).toHaveBeenCalledTimes(2);
  });

  it("holds the composer while an assistant-backed run is active", async () => {
    const submitLearning = vi.fn();
    await expect(
      submitWorkLearning(
        { ...input, threadId: "work-learning-session" },
        { ...context, draft: false, running: true },
        { readModelAccess, submitLearning },
      ),
    ).resolves.toEqual({ status: "running" });
    expect(submitLearning).not.toHaveBeenCalled();
  });
});

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
