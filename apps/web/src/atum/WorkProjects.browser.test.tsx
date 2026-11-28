import { createMemoryHistory } from "@tanstack/react-router";
import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import { ProjectId, ThreadId } from "@t3tools/contracts";
import { DEFAULT_CLIENT_SETTINGS } from "@t3tools/contracts/settings";
import type * as Context from "effect/Context";
import { expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";

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
  threadWithHistory,
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

const OTHER_PROJECT = ProjectId.make("project-q4");
// One session for every test: the client keeps the shell it has already loaded across a file's tests.
const EARLIER = "work-earlier";
const chipSelector = "[data-atum-work-project-row] [data-atum-work-project-chip]";

async function openWorkDraft(theme: "light" | "dark", name: string) {
  const style = document.createElement("style");
  style.textContent = stylesheet;
  document.documentElement.dataset.atumMode = "work";
  document.head.append(style);
  setAppearanceMode(theme);
  const environment = installFakeEnvironment([threadWithHistory(EARLIER, 1)], {
    extraProjects: [{ id: OTHER_PROJECT, title: "Q4 planning" }],
  });
  __setClientSettingsForTests({
    ...DEFAULT_CLIENT_SETTINGS,
    onboardingCompletedAt: "2026-01-01T00:00:00.000Z",
  });
  const draftId = DraftId.make(`draft-${name}-${theme}`);
  useComposerDraftStore
    .getState()
    .setProjectDraftThreadId(scopeProjectRef(ENVIRONMENT_ID, PROJECT_ID), draftId, {
      threadId: ThreadId.make(`thread-${name}-${theme}`),
    });
  const router = getRouter(createMemoryHistory({ initialEntries: [`/draft/${draftId}`] }));
  await router.load();
  const app = await render(<AppRoot router={router} />, { router: false });
  return {
    async [Symbol.asyncDispose]() {
      await app[Symbol.asyncDispose]();
      environment[Symbol.dispose]();
      delete document.documentElement.dataset.atumMode;
      style.remove();
      setAppearanceMode("system");
    },
  };
}

it.each(["light", "dark"] as const)(
  "Work's home greets, and its project chip under the composer picks a project or a folder (%s)",
  async (theme) => {
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    await page.viewport(1440, 900);
    await using _viewport = {
      [Symbol.asyncDispose]: () => page.viewport(viewport.width, viewport.height),
    };
    await using _app = await openWorkDraft(theme, "work-home");

    await expect
      .element(page.getByRole("heading", { name: /^Good (morning|afternoon|evening)$/ }))
      .toBeVisible();
    const editor = page.getByTestId("composer-editor");
    await expect.element(editor).toBeVisible();
    await expect.element(page.getByText("How can I help today?")).toBeVisible();

    await expect.poll(() => document.querySelector(chipSelector)).not.toBeNull();
    const chip = page.elementLocator(document.querySelector(chipSelector)!);
    // DraftProjectName breaks long names with invisible break points; read the plain name.
    expect(chip.element().textContent?.replace(/[^a-z]/gi, "")).toContain("render");
    expect(chip.element().getBoundingClientRect().top).toBeGreaterThan(
      editor.element().getBoundingClientRect().bottom,
    );

    // The shell snapshot has arrived once the list shows the earlier session; the picker keeps its
    // rows while open, so open it after that.
    await expect.element(page.getByText(`Thread ${EARLIER}`)).toBeVisible();
    // The hero can remount while the draft settles; press again until the list is open.
    await expect
      .poll(
        async () => {
          if (document.querySelector('[role="listbox"]')) return true;
          await userEvent.click(page.elementLocator(document.querySelector(chipSelector)!));
          return document.querySelector('[role="listbox"]') !== null;
        },
        { timeout: 10_000, interval: 500 },
      )
      .toBe(true);
    await expect.element(page.getByRole("option", { name: "Q4 planning" })).toBeVisible();
    await expect.element(page.getByRole("option", { name: "Choose a folder…" })).toBeVisible();
    await expect.element(page.getByRole("option", { name: "Add project" })).not.toBeInTheDocument();
    const evidence = import.meta.env.VITE_COWORK_EVIDENCE;
    if (evidence) await page.screenshot({ path: `${evidence}/work-project-picker-${theme}.png` });
    await userEvent.keyboard("{Escape}");
  },
);

it("Work's list groups sessions under their project and offers New session without worktrees", async () => {
  const viewport = { width: window.innerWidth, height: window.innerHeight };
  await page.viewport(1440, 900);
  await using _viewport = {
    [Symbol.asyncDispose]: () => page.viewport(viewport.width, viewport.height),
  };
  await using _app = await openWorkDraft("light", "work-list");

  await expect.element(page.getByText(`Thread ${EARLIER}`)).toBeVisible();
  // The session sits under its project's folder header, which opens and closes the group.
  const folder = page.getByTestId("sidebar-project-folder").filter({ hasText: "render" });
  await expect.element(folder.getByRole("button", { expanded: true }).first()).toBeVisible();

  // The unsent draft is a session in the header too.
  await expect.element(page.getByText("New session", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "New", exact: true }).click();
  await expect.element(page.getByRole("menuitem", { name: /New session/ })).toBeVisible();
  await expect.element(page.getByRole("menuitem", { name: /Add project/ })).toBeVisible();
  await expect.element(page.getByRole("menuitem", { name: /worktree/ })).not.toBeInTheDocument();
  const evidence = import.meta.env.VITE_COWORK_EVIDENCE;
  if (evidence) await page.screenshot({ path: `${evidence}/work-list-by-project-light.png` });
  await userEvent.keyboard("{Escape}");
});
