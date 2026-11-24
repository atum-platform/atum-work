import { useEffect } from "react";

import { useSidebar } from "../components/ui/sidebar";
import { observeResize } from "../lib/observeResize";

/**
 * Tells the Atum host where the thread list ends, so its title band ends the bell at that edge as the
 * chat roster does. The edge is the visible panel's right side in this view's CSS pixels.
 */
export function AtumSidebarReport() {
  const { open, isMobile } = useSidebar();
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- reports the sidebar's laid-out edge to the native host
  useEffect(() => {
    const report = () => {
      const inner = document.querySelector<HTMLElement>(
        '[data-app-sidebar] [data-slot="sidebar-inner"]',
      );
      const edge = inner?.getBoundingClientRect().right ?? 0;
      const shown = open && !isMobile && edge > 0;
      void window.atumWork?.reportSidebar?.({ open: shown, edge: shown ? edge : 0 });
    };
    const container = document.querySelector<HTMLElement>(
      '[data-app-sidebar] [data-slot="sidebar-container"]',
    );
    const stopObserving = container ? observeResize(container, report) : () => {};
    // Opening slides the panel in, which resizes nothing: read it again where the slide ends.
    container?.addEventListener("transitionend", report);
    report();
    return () => {
      stopObserving();
      container?.removeEventListener("transitionend", report);
    };
  }, [open, isMobile]);
  return null;
}
