import { useSyncExternalStore } from "react";

/** The open thread's right panel as the Atum host's title-bar toggle needs it. */
export interface AtumRightPanel {
  readonly open: boolean;
  readonly toggle: () => void;
}

let current: AtumRightPanel | null = null;
const listeners = new Set<() => void>();

/** The chat view offers its panel; the returned function withdraws it (unmount, thread without a project). */
export function offerAtumRightPanel(panel: AtumRightPanel): () => void {
  current = panel;
  for (const listener of listeners) listener();
  return () => {
    if (current !== panel) return;
    current = null;
    for (const listener of listeners) listener();
  };
}

export function toggleAtumRightPanel(): boolean {
  if (!current) return false;
  current.toggle();
  return true;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** "open" / "closed" while a panel is offered, undefined otherwise. */
export function useAtumRightPanelState(): "open" | "closed" | undefined {
  return useSyncExternalStore(subscribe, () =>
    current ? (current.open ? "open" : "closed") : undefined,
  );
}
