import { afterEach, expect, it, vi } from "vite-plus/test";
import { openProviderSignIn, prepareWorkCodexSignIn } from "./workProviderSignIn";

const { openExternal } = vi.hoisted(() => ({ openExternal: vi.fn() }));
vi.mock("../../localApi", () => ({ ensureLocalApi: () => ({ shell: { openExternal } }) }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it("continues to native T3 authentication without the retired Work custody bridge", async () => {
  const prepareCodexSignIn = vi.fn().mockResolvedValue(false);
  vi.stubGlobal("window", { atumWork: { prepareCodexSignIn } });
  const startNativeAuth = vi.fn();
  if (await prepareWorkCodexSignIn()) startNativeAuth();
  expect(startNativeAuth).toHaveBeenCalledOnce();
  expect(prepareCodexSignIn).not.toHaveBeenCalled();
});

it("allows native login when the current Work host omits the retired bridge", async () => {
  vi.stubGlobal("window", { atumWork: {} });
  expect(await prepareWorkCodexSignIn()).toBe(true);
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
