import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vite-plus/test";

const { activate, deactivate } = vi.hoisted(() => ({ activate: vi.fn(), deactivate: vi.fn() }));
vi.mock("../../../apps/web/src/cloud/managedAuth", () => ({
  activateManagedRelayAuthentication: activate,
  deactivateManagedRelayAuthentication: deactivate,
}));

it("mounts Atum auth without Clerk, reads fresh owner assertions and tears down", async () => {
  vi.stubEnv("VITE_ATUM_WORK_BUILD", "1");
  const { default: Shell } = await import("../../../apps/web/src/atum/ConnectAuthShell");
  const { useConnectAuth } = await import("../../../apps/web/src/cloud/connectAuth");
  const { hasCloudPublicConfig, relayTelemetryEnabled, resolveCloudPublicConfig } = await import("../../../apps/web/src/cloud/publicConfig");
  expect(hasCloudPublicConfig()).toBe(true);
  expect(resolveCloudPublicConfig().relayUrl).toBe("https://relay.atumplatform.com");
  expect(relayTelemetryEnabled()).toBe(false);
  let owner = "owner-a";
  let nonce = 0;
  const getConnectAssertion = vi.fn(async () => `header.${btoa(JSON.stringify({ sub: owner, exp: Math.floor(Date.now() / 1000) + 60, jti: ++nonce }))}.signature`);
  Object.assign(window, { atumWork: { getConnectAssertion } });
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  let auth: ReturnType<typeof useConnectAuth> | undefined;
  function Consumer() { auth = useConnectAuth(); return null; }
  const root = createRoot(document.createElement("div"));
  await act(async () => { root.render(<Shell publishableKey=""><Consumer /></Shell>); });
  expect(auth?.isSignedIn).toBe(true);
  expect(auth?.userId).toBe("owner-a");
  expect(activate).toHaveBeenCalledWith("owner-a", expect.any(Function));
  const read = activate.mock.calls[0]![1] as () => Promise<string>;
  expect(await read()).not.toBe(await read());
  expect(await auth!.getToken()).toContain("signature");
  owner = "owner-b";
  await expect(read()).rejects.toThrow("Atum account changed");
  await expect(auth!.getToken()).rejects.toThrow("Atum account changed");
  await act(async () => { root.unmount(); });
  await expect(read()).rejects.toThrow("Atum account changed");
  expect(deactivate).toHaveBeenCalled();
  vi.unstubAllEnvs();
});
