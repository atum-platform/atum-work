import { useAtomValue } from "@effect/atom-react";
import { primaryWorkShellReadyAtom, reportWorkStartupPhase } from "./StartupReport";
import { useEffect } from "react";

import { useSidebar } from "../components/ui/sidebar";
import { observeResize } from "../lib/observeResize";
import { useCanNavigateHistory } from "../navigationHistory";
import { useAtumRightPanelState } from "./rightPanel";

/**
 * Tells the Atum host where the thread list ends, so its title band ends the bell at that edge as the
 * chat roster does. The edge is the visible panel's right side in this view's CSS pixels. It also says
 * whether T3's own history can step back or forward, so the window's ← → go through it first.
 */
export function AtumSidebarReport() {
  const shellReady = useAtomValue(primaryWorkShellReadyAtom);
  const { open, isMobile } = useSidebar();
  const back = useCanNavigateHistory("back");
  const forward = useCanNavigateHistory("forward");
  const rightPanel = useAtumRightPanelState();
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- reports the sidebar's laid-out edge to the native host
  useEffect(() => {
    const report = () => {
      const inner = document.querySelector<HTMLElement>(
        '[data-app-sidebar] [data-slot="sidebar-inner"]',
      );
      const edge = inner?.getBoundingClientRect().right ?? 0;
      const shown = open && !isMobile && edge > 0;
      void window.atumWork?.reportSidebar?.({
        open: shown,
        edge: shown ? edge : 0,
        back,
        forward,
        ...(rightPanel ? { rightPanel } : {}),
      });
    };
    const container = document.querySelector<HTMLElement>(
      '[data-app-sidebar] [data-slot="sidebar-container"]',
    );
    const stopObserving = container ? observeResize(container, report) : () => {};
    // Opening slides the panel in, which resizes nothing: read it again where the slide ends.
    container?.addEventListener("transitionend", report);
    report();
    // Two frames observe a committed sidebar after the browser has had a paint opportunity.
    let second = 0;
    const first = requestAnimationFrame(() => {
      if (shellReady)
        second = requestAnimationFrame(() => reportWorkStartupPhase("threads-painted"));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
      stopObserving();
      container?.removeEventListener("transitionend", report);
    };
  }, [open, isMobile, shellReady, back, forward, rightPanel]);
  return null;
}
