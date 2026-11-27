import { expect, it, vi } from "vite-plus/test";

import { act, render } from "../../test/render";
import { atumOpenThreadFrom, offerAtumOpenThread } from "./openThread";
import { AtumSidebarReport } from "./SidebarReport";

vi.mock("../components/ui/sidebar", () => ({
  useSidebar: () => ({ open: true, isMobile: false }),
}));
vi.mock("./StartupReport", async () => {
  const { Atom } = await import("effect/reactivity");
  return { primaryWorkShellReadyAtom: Atom.make(false), reportWorkStartupPhase: () => {} };
});

it("reports both native history directions and updates after stepping back", async () => {
  const navigation = Object.assign(new EventTarget(), { canGoBack: true, canGoForward: false });
  const reportSidebar = vi.fn(async () => {});
  vi.stubGlobal("navigation", navigation);
  vi.stubGlobal("atumWork", { reportSidebar });
  try {
    await using screen = await render(<AtumSidebarReport />);
    expect(reportSidebar).toHaveBeenLastCalledWith({
      open: false,
      edge: 0,
      back: true,
      forward: false,
      thread: null,
    });
    await act(() => {
      navigation.canGoBack = false;
      navigation.canGoForward = true;
      navigation.dispatchEvent(new Event("currententrychange"));
    });
    expect(reportSidebar).toHaveBeenLastCalledWith({
      open: false,
      edge: 0,
      back: false,
      forward: true,
      thread: null,
    });
    await screen.unmount();
    const reports = reportSidebar.mock.calls.length;
    navigation.dispatchEvent(new Event("currententrychange"));
    expect(reportSidebar).toHaveBeenCalledTimes(reports);
  } finally {
    vi.unstubAllGlobals();
  }
});

it("reports disabled history in browsers without the Navigation API", async () => {
  const reportSidebar = vi.fn(async () => {});
  vi.stubGlobal("navigation", undefined);
  vi.stubGlobal("atumWork", { reportSidebar });
  try {
    await using _screen = await render(<AtumSidebarReport />);
    expect(reportSidebar).toHaveBeenLastCalledWith({
      open: false,
      edge: 0,
      back: false,
      forward: false,
      thread: null,
    });
  } finally {
    vi.unstubAllGlobals();
  }
});

it("names the open thread for the title bar and withdraws it when the thread closes", async () => {
  const reportSidebar = vi.fn(async () => {});
  vi.stubGlobal("navigation", undefined);
  vi.stubGlobal("atumWork", { reportSidebar });
  try {
    await using _screen = await render(<AtumSidebarReport />);
    let withdraw = () => {};
    await act(() => {
      withdraw = offerAtumOpenThread(
        atumOpenThreadFrom({ title: " Fix login ", repo: "atum-app", branch: "fix/login" }),
      );
    });
    expect(reportSidebar).toHaveBeenLastCalledWith(
      expect.objectContaining({
        thread: { title: "Fix login", repo: "atum-app", branch: "fix/login" },
      }),
    );
    await act(() => withdraw());
    expect(reportSidebar).toHaveBeenLastCalledWith(expect.objectContaining({ thread: null }));
  } finally {
    vi.unstubAllGlobals();
  }
});
