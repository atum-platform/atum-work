import { afterEach, expect, it, vi } from "vite-plus/test";
import { dispatchMenuAction, runCommand } from "../shortcuts/dispatcher";
import { openCommandPalette } from "../commandPaletteBus";
import { installAtumWorkCommands, runAtumBandCommand } from "./workCommands";

vi.mock("../shortcuts/dispatcher", () => ({ dispatchMenuAction: vi.fn(), runCommand: vi.fn(() => true) }));
vi.mock("../commandPaletteBus", () => ({ isCommandPaletteOpen: () => false, openCommandPalette: vi.fn() }));
vi.mock("../lib/desktopSnapShot", () => ({ dispatchSnapShotComposerFocus: vi.fn() }));
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

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
