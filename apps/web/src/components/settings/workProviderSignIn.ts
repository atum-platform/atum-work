import { ensureLocalApi } from "../../localApi";

export async function prepareWorkCodexSignIn(): Promise<boolean> {
  const bridge = window.atumWork;
  if (!bridge) return true;
  try {
    return (await bridge.prepareCodexSignIn?.()) === true;
  } catch {
    return false;
  }
}

export async function openProviderSignIn(provider: string, url: string): Promise<void> {
  const bridge = window.atumWork;
  if (bridge && (provider === "codex" || provider === "claudeAgent" || provider === "antigravity")) {
    if ((await bridge.openProviderSignIn?.(provider, url)) !== true) {
      throw new Error("Work could not open provider sign-in.");
    }
    return;
  }
  await ensureLocalApi().shell.openExternal(url);
}
