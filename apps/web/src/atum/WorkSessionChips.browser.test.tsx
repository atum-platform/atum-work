import { createMemoryHistory } from "@tanstack/react-router";
import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import {
  ORCHESTRATION_V2_WS_METHODS,
  ThreadId,
  WS_METHODS,
  type OrchestrationV2ThreadLaunchInput,
} from "@t3tools/contracts";
import { DEFAULT_CLIENT_SETTINGS } from "@t3tools/contracts/settings";
import type * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";

import { officeStarters } from "@t3tools/shared/workOfficeStarters";
import { AppRoot } from "~/AppRoot";
import "~/components/ChatView";
import { DraftId, useComposerDraftStore } from "~/composerDraftStore";
import type { WorkLearningSubmission } from "~/components/chat/workSubmitAccess";
import { __setClientSettingsForTests } from "~/hooks/useSettings";
import { setAppearanceMode } from "~/hooks/useTheme";
import stylesheet from "~/index.css?inline";
import { getRouter } from "~/router";
import {
  ENVIRONMENT_ID,
  PROJECT_ID,
  answerRpc,
  installFakeEnvironment,
  publishFakeThread,
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

vi.mock(import("~/atum/surfaceMode"), async (original) => {
  const actual = await original();
  return {
    ...actual,
    useAtumSurfaceModeController: (...args) => ({
      ...actual.useAtumSurfaceModeController(...args),
      mode: "work" as const,
    }),
  };
});

it.each(["light", "dark"] as const)(
  "opens a Work starter and preserves the draft (%s)",
  async (theme) => {
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    await page.viewport(1440, 900);
    await using _viewport = {
      [Symbol.asyncDispose]: () => page.viewport(viewport.width, viewport.height),
    };
    const style = document.createElement("style");
    style.textContent = stylesheet;
    const previousMode = document.documentElement.dataset.atumMode;
    document.documentElement.dataset.atumMode = "work";
    document.head.append(style);
    using _style = {
      [Symbol.dispose]: () => {
        if (previousMode === undefined) delete document.documentElement.dataset.atumMode;
        else document.documentElement.dataset.atumMode = previousMode;
        style.remove();
        setAppearanceMode("system");
      },
    };
    setAppearanceMode(theme);

    const assetPath = "/api/assets/work-starter/Untitled.docx";
    const documentBytes = Uint8Array.from(atob(officeStarters.docx), (char) => char.charCodeAt(0));
    using _environment = installFakeEnvironment([], {
      workStarters: true,
      assets: new Map([[assetPath, new Blob([documentBytes])]]),
    });
    using _asset = answerRpc(WS_METHODS.assetsCreateUrl, () =>
      Effect.succeed({ relativeUrl: assetPath, expiresAt: Number.MAX_SAFE_INTEGER }),
    );
    using _file = answerRpc(WS_METHODS.projectsReadFile, () =>
      Effect.succeed({
        relativePath: "Untitled.docx",
        contents: "",
        byteLength: documentBytes.byteLength,
        truncated: false,
      }),
    );
    using _entries = answerRpc(WS_METHODS.projectsListEntries, () =>
      Effect.succeed({ entries: [{ path: "Untitled.docx", kind: "file" }], truncated: false }),
    );
    const launches: OrchestrationV2ThreadLaunchInput[] = [];
    using _launch = answerRpc(
      ORCHESTRATION_V2_WS_METHODS.launchThread,
      (input: OrchestrationV2ThreadLaunchInput) => {
        const id = input.threadId;
        if (id === undefined) throw new Error("Work must promote the existing draft ID.");
        launches.push(input);
        return publishFakeThread({
          id,
          title: input.title,
          modelSelection: input.modelSelection,
          worktreePath: "/workspace/render/work-starter",
          runs: [],
          items: [],
        }).pipe(
          Effect.map((projection) => ({
            threadId: id,
            projection,
            resumed: false,
            workStarter: { format: "docx", relativePath: "Untitled.docx" },
          })),
        );
      },
    );
    __setClientSettingsForTests({
      ...DEFAULT_CLIENT_SETTINGS,
      onboardingCompletedAt: "2026-01-01T00:00:00.000Z",
    });
    const draftId = DraftId.make(`draft-work-starter-${theme}`);
    const threadId = ThreadId.make(`thread-work-starter-${theme}`);
    useComposerDraftStore
      .getState()
      .setProjectDraftThreadId(scopeProjectRef(ENVIRONMENT_ID, PROJECT_ID), draftId, { threadId });
    const router = getRouter(createMemoryHistory({ initialEntries: [`/draft/${draftId}`] }));
    await router.load();
    await using _app = await render(<AppRoot router={router} />, { router: false });

    const editor = page.getByTestId("composer-editor");
    await expect.element(editor).toBeVisible();
    for (const label of ["Write", "Design", "Analyze numbers"]) {
      await expect.element(page.getByRole("button", { name: label, exact: true })).toBeEnabled();
    }
    const write = page.getByRole("button", { name: "Write", exact: true });
    expect(write.element().getBoundingClientRect().top).toBeGreaterThan(
      editor.element().getBoundingClientRect().bottom,
    );
    const evidence = import.meta.env.VITE_COWORK_EVIDENCE;
    if (evidence) await page.screenshot({ path: `${evidence}/new-session-${theme}.png` });
    useComposerDraftStore.getState().setPrompt(draftId, "Draft a weekly update");
    await expect.element(editor).toHaveTextContent("Draft a weekly update");
    await page.getByRole("button", { name: "Create", exact: true }).click();
    for (const label of ["Document", "Spreadsheet", "Slides", "Design"]) {
      await expect.element(page.getByRole("menuitem", { name: label, exact: true })).toBeVisible();
    }
    if (evidence) await page.screenshot({ path: `${evidence}/create-menu-${theme}.png` });
    if (theme === "light") {
      await page.getByRole("menuitem", { name: "Document", exact: true }).click();
    } else {
      await userEvent.keyboard("{Escape}");
      await write.click();
    }
    await expect.element(page.getByText("Untitled.docx", { exact: true }).first()).toBeVisible();
    await expect.element(page.getByText(/Fit to width/)).toBeVisible();
    await expect
      .element(page.getByText("Loading files...", { exact: true }))
      .not.toBeInTheDocument();
    await expect.element(editor).toHaveTextContent("Draft a weekly update");
    expect(launches).toHaveLength(1);
    expect(launches[0]).toMatchObject({
      threadId,
      workFormat: "docx",
      workspaceStrategy: { type: "root" },
    });
    expect(launches[0]?.initialMessage).toBeUndefined();
    if (evidence) await page.screenshot({ path: `${evidence}/document-${theme}.png` });
  },
);

it.each(["started", "standalone"] as const)(
  "sends a Work composer draft through the owner handoff (%s)",
  async (status) => {
    using _environment = installFakeEnvironment([], { workStarters: true });
    const draftId = DraftId.make(`work-composer-${status}`);
    const threadId = ThreadId.make(`draft-${status}`);
    const attachedId = ThreadId.make("work-learning-receipt");
    const launches: OrchestrationV2ThreadLaunchInput[] = [];
    using _launch = answerRpc(
      ORCHESTRATION_V2_WS_METHODS.launchThread,
      (input: OrchestrationV2ThreadLaunchInput) => {
        launches.push(input);
        return publishFakeThread({
          id: threadId,
          title: input.title,
          modelSelection: input.modelSelection,
          runs: [],
          items: [],
        }).pipe(Effect.map((projection) => ({ threadId, projection, resumed: false })));
      },
    );
    const submitLearning = vi.fn(async (input: WorkLearningSubmission) => {
      if (status === "standalone") return { status };
      await Effect.runPromise(
        publishFakeThread({
          id: attachedId,
          title: "Assistant work",
          modelSelection: input.modelSelection,
          runs: [],
          items: [],
        }),
      );
      return { status, threadId: attachedId };
    });
    vi.stubGlobal("atumWork", { readModelAccess: async () => "allowed", submitLearning });
    using _bridge = { [Symbol.dispose]: () => vi.unstubAllGlobals() };
    __setClientSettingsForTests({
      ...DEFAULT_CLIENT_SETTINGS,
      onboardingCompletedAt: "2026-01-01T00:00:00.000Z",
    });
    const draft = useComposerDraftStore.getState();
    draft.setProjectDraftThreadId(scopeProjectRef(ENVIRONMENT_ID, PROJECT_ID), draftId, {
      threadId,
    });
    draft.setPrompt(draftId, "Remember the weekly update format.");
    const router = getRouter(createMemoryHistory({ initialEntries: [`/draft/${draftId}`] }));
    await router.load();
    await using _app = await render(<AppRoot router={router} />, { router: false });
    const editor = page.getByTestId("composer-editor");
    await expect.element(editor).toHaveTextContent("Remember the weekly update format.");
    const send = page.getByRole("button", { name: "Submit message", exact: true });
    await expect.element(send).toBeEnabled();
    await send.click();

    await vi.waitFor(() =>
      expect(submitLearning).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ threadId, text: "Remember the weekly update format." }),
      ),
    );
    if (status === "started") {
      await vi.waitFor(() => expect(router.state.location.pathname).toContain(attachedId));
      expect(launches).toHaveLength(0);
    } else {
      await expect.element(page.getByText("Standalone Work session")).toBeVisible();
      await vi.waitFor(() => expect(launches).toHaveLength(1));
      expect(launches[0]?.threadId).toBe(threadId);
    }
  },
);
