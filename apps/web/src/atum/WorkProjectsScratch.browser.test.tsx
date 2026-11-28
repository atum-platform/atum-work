import { createMemoryHistory } from "@tanstack/react-router";
import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import { ThreadId } from "@t3tools/contracts";
import { DEFAULT_CLIENT_SETTINGS } from "@t3tools/contracts/settings";
import type * as Context from "effect/Context";
import { expect, it, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";

import { AppRoot } from "~/AppRoot";
import "~/components/ChatView";
import { DraftId, useComposerDraftStore } from "~/composerDraftStore";
import { __setClientSettingsForTests } from "~/hooks/useSettings";
import { setAppearanceMode } from "~/hooks/useTheme";
import stylesheet from "~/index.css?inline";
import { getRouter } from "~/router";
import {
  ENVIRONMENT_ID,
  PROJECT_ID,
  installFakeEnvironment,
  type FakeDriver,
} from "../../test/fakeEnvironment";
import { render } from "../../test/render";

vi.mock("../../../../packages/client-runtime/src/connection/driver.ts", async (importOriginal) => {
  const [actual, { fakeDriver }, Layer] = await Promise.all([
    importOriginal<{ readonly ConnectionDriver: Context.Key<unknown, FakeDriver> }>(),
    import("../../test/fakeEnvironment"),
    import("effect/Layer"),
  ]);
  return { ...actual, layer: Layer.succeed(actual.ConnectionDriver, fakeDriver) };
});

// The Atum Work build with the open chat in Work mode.
vi.mock(import("~/atum/surfaceMode"), async (original) => {
  const actual = await original();
  return {
    ...actual,
    isAtumWorkBuild: true,
    useActiveAtumSurfaceMode: () => "work" as const,
    useAtumSurfaceModeController: (...args) => ({
      ...actual.useAtumSurfaceModeController(...args),
      mode: "work" as const,
    }),
  };
});

const chipSelector = "[data-atum-work-project-row] [data-atum-work-project-chip]";

it("Work's no-project home names the chip Project or folder, above the starters", async () => {
  const viewport = { width: window.innerWidth, height: window.innerHeight };
  await page.viewport(1440, 900);
  await using _viewport = {
    [Symbol.asyncDispose]: () => page.viewport(viewport.width, viewport.height),
  };
  const style = document.createElement("style");
  style.textContent = stylesheet;
  document.documentElement.dataset.atumMode = "work";
  document.head.append(style);
  using _style = {
    [Symbol.dispose]: () => {
      delete document.documentElement.dataset.atumMode;
      style.remove();
      setAppearanceMode("system");
    },
  };
  setAppearanceMode("light");
  // With starters on, the fake environment's one project is the no-project (scratch) home.
  using _environment = installFakeEnvironment([], { workStarters: true });
  __setClientSettingsForTests({
    ...DEFAULT_CLIENT_SETTINGS,
    onboardingCompletedAt: "2026-01-01T00:00:00.000Z",
  });
  const draftId = DraftId.make("draft-work-scratch");
  useComposerDraftStore
    .getState()
    .setProjectDraftThreadId(scopeProjectRef(ENVIRONMENT_ID, PROJECT_ID), draftId, {
      threadId: ThreadId.make("thread-work-scratch"),
    });
  const router = getRouter(createMemoryHistory({ initialEntries: [`/draft/${draftId}`] }));
  await router.load();
  await using _app = await render(<AppRoot router={router} />, { router: false });

  const write = page.getByRole("button", { name: "Write", exact: true });
  await expect.element(write).toBeEnabled();
  await expect
    .poll(() => document.querySelector(chipSelector)?.textContent ?? "")
    .toContain("Project or folder");
  expect(document.querySelector(chipSelector)!.getBoundingClientRect().bottom).toBeLessThanOrEqual(
    write.element().getBoundingClientRect().top,
  );
  await expect.element(page.getByText("No sessions yet", { exact: true })).toBeVisible();
  const evidence = import.meta.env.VITE_COWORK_EVIDENCE;
  if (evidence) await page.screenshot({ path: `${evidence}/work-no-project-home-light.png` });
});
