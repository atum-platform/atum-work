import { expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";

import type { ComposerAutoswitchLine } from "../../atum/providerAutoswitch.logic";
import { render } from "../../../test/render";
import "~/index.css";
import { ComposerAutoswitchLineView } from "./ComposerAutoswitch";

const COST_WORDS = /proton|\$|cost|price|credit|token|relay|fallback/i;

it.each<[ComposerAutoswitchLine, RegExp]>([
  [
    { kind: "switched", out: "ChatGPT", using: "Claude", until: null },
    /^ChatGPT is out · using Claude$/,
  ],
  [
    { kind: "switched", out: "ChatGPT", using: "Claude", until: "2026-11-28T13:37:00.000Z" },
    /^ChatGPT is out until .+ · using Claude$/,
  ],
  [
    { kind: "next", out: "ChatGPT", using: "Claude", until: null },
    /^ChatGPT is out · Claude answers next$/,
  ],
])("draws one quiet line with no action and no cost (%o)", async (line, words) => {
  await using screen = await render(
    <ComposerAutoswitchLineView line={line} onResume={() => {}} />,
    {
      router: false,
    },
  );
  const text = screen.container.textContent ?? "";
  expect(text).toMatch(words);
  expect(text).not.toMatch(COST_WORDS);
  expect(text.length).toBeLessThanOrEqual(64);
  await expect.element(screen.getByRole("button")).not.toBeInTheDocument();
});

it("offers one Continue after a cut-off run, on the plan that answers next", async () => {
  const onResume = vi.fn();
  await using screen = await render(
    <ComposerAutoswitchLineView
      line={{ kind: "continue", out: "ChatGPT", using: "Claude" }}
      onResume={onResume}
    />,
    { router: false },
  );
  await expect.element(screen.getByText("ChatGPT ran out mid-reply")).toBeVisible();
  await expect.element(screen.getByRole("button")).toHaveLength(1);
  await userEvent.click(screen.getByRole("button", { name: "Continue with Claude" }));
  expect(onResume).toHaveBeenCalledTimes(1);
});
