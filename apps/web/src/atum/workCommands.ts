import { dispatchMenuAction, runCommand } from "../shortcuts/dispatcher";
import { isCommandPaletteOpen } from "../commandPaletteBus";
import { dispatchSnapShotComposerFocus } from "../lib/desktopSnapShot";

/** The commands Atum's title band offers as buttons over the roster column. */
export const ATUM_BAND_COMMANDS = ["sidebar.toggle", "chat.new"] as const;
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
  if (command !== "chat.new" || !runCommand(command)) return false;
  // On an empty draft T3 reuses it, so the press would show nothing: land the caret in its composer.
  window.requestAnimationFrame(() => {
    if (!isCommandPaletteOpen()) dispatchSnapShotComposerFocus();
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
