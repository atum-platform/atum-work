import { dispatchMenuAction, runCommand } from "../shortcuts/dispatcher";
import { isCommandPaletteOpen, openCommandPalette } from "../commandPaletteBus";
import { dispatchSnapShotComposerFocus } from "../lib/desktopSnapShot";

/** The commands Atum's title band offers as buttons over the roster column. */
// Atum's plus menu maps T3's pencil: New thread, New thread in a worktree, Add project.
export const ATUM_BAND_COMMANDS = [
  "sidebar.toggle",
  "chat.new",
  "chat.newWorktree",
  "project.add",
] as const;
export type AtumBandCommand = (typeof ATUM_BAND_COMMANDS)[number];

declare global {
  interface Window {
    atumWorkCommands?: { run(command: string): boolean };
  }
}

export function runAtumBandCommand(command: string): boolean {
  if (command === "sidebar.toggle") {
    dispatchMenuAction(command);
    return true;
  }
  if (command === "project.add") {
    openCommandPalette({ open: "add-project" });
    return true;
  }
  const worktree = command === "chat.newWorktree";
  if ((command !== "chat.new" && !worktree) || !runCommand("chat.new")) return false;
  // On an empty draft T3 reuses it, so the press would show nothing: land the caret in its composer.
  // In a worktree: the composer's own workspace picker opens, where a new worktree is one choice.
  window.requestAnimationFrame(() => {
    if (isCommandPaletteOpen()) return;
    if (worktree) runCommand("composer.workspace");
    else dispatchSnapShotComposerFocus();
  });
  return true;
}

export function installAtumWorkCommands(): () => void {
  const bridge = { run: runAtumBandCommand };
  window.atumWorkCommands = bridge;
  return () => {
    if (window.atumWorkCommands === bridge) delete window.atumWorkCommands;
  };
}
