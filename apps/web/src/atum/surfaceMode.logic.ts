import type { RightPanelSurface } from "../rightPanelStore";

// Work mode hides the source-control and terminal surfaces; Files, Preview, Browser and Device stay.
const CODE_ONLY_SURFACES = new Set<RightPanelSurface["kind"]>([
  "diff",
  "terminal",
  "pull-request",
  "pull-requests",
  "issue",
]);

export function isWorkModeHiddenSurface(
  workMode: boolean,
  surface: Pick<RightPanelSurface, "kind">,
) {
  return workMode && CODE_ONLY_SURFACES.has(surface.kind);
}

/** The same commands, answered as "not handled" so a Work-mode chord can't open a terminal. */
export function workModeDisabledShortcuts<T extends Record<string, unknown>>(
  shortcuts: T,
): { [K in keyof T]: () => false } {
  return Object.fromEntries(Object.keys(shortcuts).map((name) => [name, () => false])) as {
    [K in keyof T]: () => false;
  };
}
