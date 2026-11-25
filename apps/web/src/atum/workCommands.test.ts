import { describe, expect, it, vi } from "vite-plus/test";

import { installAtumWorkCommands, runAtumBandCommand } from "./workCommands";

vi.mock("../shortcuts/dispatcher", () => ({ dispatchMenuAction: vi.fn(), runCommand: vi.fn() }));
vi.mock("../commandPaletteBus", () => ({
  isCommandPaletteOpen: vi.fn(),
  openCommandPalette: vi.fn(),
}));
vi.mock("../lib/desktopSnapShot", () => ({ dispatchSnapShotComposerFocus: vi.fn() }));

describe("Work window history commands", () => {
  it.each(["back", "forward"] as const)(
    "steps native %s history only when available",
    (direction) => {
      const history = { back: vi.fn(), forward: vi.fn() };
      const navigation = { canGoBack: false, canGoForward: false };
      vi.stubGlobal("window", { navigation, history });
      const uninstall = installAtumWorkCommands();
      try {
        expect(window.atumWorkCommands?.run(`history.${direction}`)).toBe(false);
        expect(history.back).not.toHaveBeenCalled();
        expect(history.forward).not.toHaveBeenCalled();
        navigation[direction === "back" ? "canGoBack" : "canGoForward"] = true;
        expect(window.atumWorkCommands?.run(`history.${direction}`)).toBe(true);
        expect(history[direction]).toHaveBeenCalledOnce();
        expect(history[direction === "back" ? "forward" : "back"]).not.toHaveBeenCalled();
        expect(runAtumBandCommand("history.unknown")).toBe(false);
      } finally {
        uninstall();
        vi.unstubAllGlobals();
      }
    },
  );

  it("leaves history commands unhandled without the Navigation API", () => {
    const history = { back: vi.fn(), forward: vi.fn() };
    vi.stubGlobal("window", { history });
    try {
      expect(runAtumBandCommand("history.back")).toBe(false);
      expect(runAtumBandCommand("history.forward")).toBe(false);
      expect(history.back).not.toHaveBeenCalled();
      expect(history.forward).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
