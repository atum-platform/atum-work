import { expect, it } from "vite-plus/test";
import { isProviderSettingsVisible } from "./providerSettingsVisibility";

it("hides the delegated relay while preserving its enabled configuration", () => {
  const configured: Record<string, { enabled: boolean; showInPicker?: boolean }> = {
    owner: { enabled: true, showInPicker: true },
    delegated: { enabled: true, showInPicker: false },
    codex: { enabled: true },
  };
  expect(
    Object.entries(configured)
      .filter(([, row]) => isProviderSettingsVisible(row))
      .map(([id]) => id),
  ).toEqual(["owner", "codex"]);
  expect(configured.delegated).toEqual({ enabled: true, showInPicker: false });
});
