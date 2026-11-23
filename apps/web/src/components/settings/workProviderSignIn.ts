import { ensureLocalApi } from "../../localApi";

export async function prepareWorkCodexSignIn(): Promise<boolean> {
  // ChatGPT custody was retired. T3's native auth flow owns sign-in;
  // current Work hosts no longer expose the old custody-preflight bridge.
  return true;
}

export async function openProviderSignIn(provider: string, url: string): Promise<void> {
  const bridge = window.atumWork;
  if (
    bridge &&
    (provider === "codex" || provider === "claudeAgent" || provider === "antigravity")
  ) {
    if ((await bridge.openProviderSignIn?.(provider, url)) !== true) {
      throw new Error("Work could not open provider sign-in.");
    }
    return;
  }
  await ensureLocalApi().shell.openExternal(url);
}
