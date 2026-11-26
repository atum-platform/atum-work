import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { openCommandPalette } from "../commandPaletteBus";
import { dispatchMenuAction, runCommand } from "../shortcuts/dispatcher";
import { offerAtumRightPanel } from "./rightPanel";
import { installAtumWorkCommands, runAtumBandCommand } from "./workCommands";

vi.mock("../shortcuts/dispatcher", () => ({
  dispatchMenuAction: vi.fn(),
  runCommand: vi.fn(() => true),
}));
vi.mock("../commandPaletteBus", () => ({
  isCommandPaletteOpen: vi.fn(() => false),
  openCommandPalette: vi.fn(),
}));
vi.mock("../lib/desktopSnapShot", () => ({ dispatchSnapShotComposerFocus: vi.fn() }));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it("routes sidebar and add project through native commands", () => {
  expect(runAtumBandCommand("sidebar.toggle")).toBe(true);
  expect(dispatchMenuAction).toHaveBeenCalledWith("sidebar.toggle");
  expect(runAtumBandCommand("project.add")).toBe(true);
  expect(openCommandPalette).toHaveBeenCalledWith({ open: "add-project" });
  expect(runAtumBandCommand("unknown")).toBe(false);
});

it("opens the native workspace picker after a new worktree draft", () => {
  vi.stubGlobal("window", { requestAnimationFrame: (callback: () => void) => callback() });
  expect(runAtumBandCommand("chat.newWorktree")).toBe(true);
  expect(vi.mocked(runCommand).mock.calls).toEqual([["chat.new"], ["composer.workspace"]]);
});

it("cleans up only the bridge it installed", () => {
  vi.stubGlobal("window", {});
  const removeFirst = installAtumWorkCommands();
  const removeSecond = installAtumWorkCommands();
  removeFirst();
  expect(window.atumWorkCommands?.run).toBe(runAtumBandCommand);
  removeSecond();
  expect(window.atumWorkCommands).toBeUndefined();
});

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

  it("toggles the right panel only while the chat view offers one", () => {
    expect(runAtumBandCommand("rightPanel.toggle")).toBe(false);
    const toggle = vi.fn();
    const withdraw = offerAtumRightPanel({ open: false, toggle });
    expect(runAtumBandCommand("rightPanel.toggle")).toBe(true);
    expect(toggle).toHaveBeenCalledOnce();
    withdraw();
    expect(runAtumBandCommand("rightPanel.toggle")).toBe(false);
    expect(toggle).toHaveBeenCalledOnce();
  });

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
