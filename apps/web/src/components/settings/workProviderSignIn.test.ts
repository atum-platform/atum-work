import { afterEach, expect, it, vi } from "vite-plus/test";
import { openProviderSignIn, prepareWorkCodexSignIn } from "./workProviderSignIn";

const { openExternal } = vi.hoisted(() => ({ openExternal: vi.fn() }));
vi.mock("../../localApi", () => ({ ensureLocalApi: () => ({ shell: { openExternal } }) }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it("waits for the Work owner bridge to finish the Codex custody preflight", async () => {
  const { promise, resolve } = Promise.withResolvers<boolean>();
  const prepareCodexSignIn = vi.fn(() => promise);
  vi.stubGlobal("window", { atumWork: { prepareCodexSignIn } });
  const ready = vi.fn();
  const check = prepareWorkCodexSignIn().then(ready);
  expect(prepareCodexSignIn).toHaveBeenCalledOnce();
  expect(ready).not.toHaveBeenCalled();
  resolve(true);
  await check;
  expect(ready).toHaveBeenCalledWith(true);
});

it("refuses to start Codex when the Work bridge is unavailable", async () => {
  vi.stubGlobal("window", { atumWork: {} });
  expect(await prepareWorkCodexSignIn()).toBe(false);
  await expect(openProviderSignIn("codex", "https://auth.openai.com/")).rejects.toThrow();
  expect(openExternal).not.toHaveBeenCalled();
});

it.each(["codex", "claudeAgent", "antigravity"])(
  "hands %s sign-in to the Work owner view",
  async (provider) => {
    const openProviderSignInBridge = vi.fn().mockResolvedValue(true);
    vi.stubGlobal("window", { atumWork: { openProviderSignIn: openProviderSignInBridge } });
    const url = "https://example.test/oauth";
    await openProviderSignIn(provider, url);
    expect(openProviderSignInBridge).toHaveBeenCalledWith(provider, url);
    expect(openExternal).not.toHaveBeenCalled();
  },
);

it("keeps native T3 sign-in routing outside Work", async () => {
  vi.stubGlobal("window", {});
  const url = "https://auth.openai.com/";
  expect(await prepareWorkCodexSignIn()).toBe(true);
  await openProviderSignIn("codex", url);
  expect(openExternal).toHaveBeenCalledWith(url);
});
