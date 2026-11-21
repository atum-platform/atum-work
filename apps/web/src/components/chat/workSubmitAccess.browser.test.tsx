import { createMemoryHistory } from "@tanstack/react-router";
import { DEFAULT_CLIENT_SETTINGS } from "@t3tools/contracts/settings";
import type * as Context from "effect/Context";
import { expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";

import { AppRoot } from "~/AppRoot";
import "~/components/ChatView";
import { __setClientSettingsForTests } from "~/hooks/useSettings";
import { getRouter } from "~/router";
import {
  ENVIRONMENT_ID,
  dispatchedCommands,
  installFakeEnvironment,
  threadWithHistory,
  type FakeDriver,
} from "../../../test/fakeEnvironment";
import { render } from "../../../test/render";

vi.mock(
  "../../../../../packages/client-runtime/src/connection/driver.ts",
  async (importOriginal) => {
    const [actual, { fakeDriver }, Layer] = await Promise.all([
      importOriginal<{ readonly ConnectionDriver: Context.Key<unknown, FakeDriver> }>(),
      import("../../../test/fakeEnvironment"),
      import("effect/Layer"),
    ]);
    return { ...actual, layer: Layer.succeed(actual.ConnectionDriver, fakeDriver) };
  },
);

vi.mock(import("~/rpc/requestLatencyState"), async (original) => ({
  ...(await original()),
  trackRpcRequestSent: () => {},
}));

// Use the upstream fixture's ready provider. The unit suite verifies the production instance filter.
vi.mock(import("./workSubmitAccess"), async (original) => {
  const { checkWorkSubmitAccess } = await original();
  return { checkWorkSubmitAccess: () => checkWorkSubmitAccess(["atum-managed"]) };
});

it("keeps a refused managed draft and dispatches it once after a successful retry", async () => {
  const thread = threadWithHistory("work-submit", 3);
  using _environment = installFakeEnvironment([thread], { acceptCommands: true });
  __setClientSettingsForTests({
    ...DEFAULT_CLIENT_SETTINGS,
    onboardingCompletedAt: "2026-01-01T00:00:00.000Z",
  });
  const readModelAccess = vi
    .fn<() => Promise<"empty" | "allowed">>()
    .mockResolvedValueOnce("empty")
    .mockResolvedValueOnce("allowed");
  vi.stubGlobal("atumWork", { readModelAccess });
  try {
    const router = getRouter(
      createMemoryHistory({ initialEntries: [`/${ENVIRONMENT_ID}/${thread.id}`] }),
    );
    await router.load();
    await using _app = await render(<AppRoot router={router} />, { router: false });
    await expect.element(page.getByText(`Answer 2 for ${thread.id}.`)).toBeVisible();
    const editor = page.getByTestId("composer-editor");
    await userEvent.click(editor);
    await userEvent.type(editor, "send after refill");
    await userEvent.keyboard("{Enter}");
    await vi.waitFor(() => expect(readModelAccess).toHaveBeenCalledOnce());
    await expect
      .element(page.getByText("You're out of Protons. Add Protons to start Work."))
      .toBeVisible();
    await expect.element(editor).toHaveTextContent("send after refill");
    expect(dispatchedCommands().filter((command) => command.type === "message.dispatch")).toEqual(
      [],
    );
    expect(readModelAccess).toHaveBeenCalledOnce();

    await userEvent.keyboard("{Enter}");
    const sends = () =>
      dispatchedCommands().filter((command) => command.type === "message.dispatch");
    await vi.waitFor(() => expect(sends()).toHaveLength(1));
    expect(sends()[0]).toMatchObject({ text: "send after refill" });
    expect(readModelAccess).toHaveBeenCalledTimes(2);
  } finally {
    vi.unstubAllGlobals();
  }
});
