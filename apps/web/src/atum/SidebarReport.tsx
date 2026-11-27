import { useAtomValue } from "@effect/atom-react";
import { primaryWorkShellReadyAtom, reportWorkStartupPhase } from "./StartupReport";
import { useEffect } from "react";

import { useSidebar } from "../components/ui/sidebar";
import { observeResize } from "../lib/observeResize";
import { useCanNavigateHistory } from "../navigationHistory";
import { useAtumOpenThread } from "./openThread";
import { useAtumRightPanelState } from "./rightPanel";

/**
 * Tells the Atum host where the thread list ends (its right edge in CSS pixels, so the title band lines up),
 * whether T3's history can step back or forward, the open thread's right panel, and the open thread's
 * name, repo and branch for the title bar (`thread`, null when none is open; older hosts ignore it).
 */
export function AtumSidebarReport() {
  const shellReady = useAtomValue(primaryWorkShellReadyAtom);
  const { open, isMobile } = useSidebar();
  const back = useCanNavigateHistory("back");
  const forward = useCanNavigateHistory("forward");
  const rightPanel = useAtumRightPanelState();
  const thread = useAtumOpenThread();
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
        thread,
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
  }, [open, isMobile, shellReady, back, forward, rightPanel, thread]);
  return null;
}
