import { ProviderDriverKind, ProviderInstanceId } from "@t3tools/contracts";
import { useState } from "react";
import { expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";

import type { AutoswitchProvider } from "../../atum/providerAutoswitch.logic";
import { render } from "../../../test/render";
import "~/index.css";
import { ProviderFallbackSettings } from "./ProviderFallbackSettings";

const provider = (
  instanceId: string,
  driver: string,
  name: string,
  connected = true,
): AutoswitchProvider => ({
  instanceId: ProviderInstanceId.make(instanceId),
  driverKind: ProviderDriverKind.make(driver),
  name,
  connected,
  isDefault: instanceId === "codex",
});

const providers = [
  provider("codex", "codex", "ChatGPT"),
  provider("claudeAgent", "claudeAgent", "Claude"),
  provider("antigravity", "antigravity", "Antigravity", false),
];

function Harness(props: {
  readonly initial: ReadonlyArray<ProviderInstanceId>;
  readonly providers?: ReadonlyArray<AutoswitchProvider>;
  readonly onSignIn?: (instanceId: ProviderInstanceId) => void;
  readonly onSaved?: (order: ReadonlyArray<ProviderInstanceId>) => void;
}) {
  const [order, setOrder] = useState(props.initial);
  return (
    <ProviderFallbackSettings
      order={order}
      providers={props.providers ?? providers}
      onChange={(next) => {
        setOrder(next);
        props.onSaved?.(next);
      }}
      onSignIn={props.onSignIn ?? (() => {})}
    />
  );
}

it("is off by default, and turning it on saves the connected plans with the default first", async () => {
  const onSaved = vi.fn();
  await using screen = await render(<Harness initial={[]} onSaved={onSaved} />, { router: false });
  const toggle = screen.getByRole("switch", { name: "Switch plans when one runs out" });
  await expect.element(toggle).not.toBeChecked();
  await expect.element(screen.getByText("Off")).toBeVisible();

  await userEvent.click(toggle);
  expect(onSaved).toHaveBeenLastCalledWith(["codex", "claudeAgent"]);
  await expect.element(toggle).toBeChecked();
  await expect.element(screen.getByText("ChatGPT → Claude")).toBeVisible();

  await userEvent.click(toggle);
  expect(onSaved).toHaveBeenLastCalledWith([]);
});

it("reorders connected plans and greys a plan that isn't signed in, with one action", async () => {
  const onSaved = vi.fn();
  const onSignIn = vi.fn();
  await using screen = await render(
    <Harness
      initial={["codex", "claudeAgent"].map((value) => ProviderInstanceId.make(value))}
      onSaved={onSaved}
      onSignIn={onSignIn}
    />,
    { router: false },
  );
  await userEvent.click(screen.getByText("When a plan runs out"));
  const list = screen.getByRole("list", { name: "Plans, in the order they take over" });
  await expect.element(list.getByRole("listitem")).toHaveLength(3);

  await expect.element(screen.getByRole("button", { name: "Move ChatGPT up" })).toBeDisabled();
  await userEvent.click(screen.getByRole("button", { name: "Move Claude up" }));
  expect(onSaved).toHaveBeenLastCalledWith(["claudeAgent", "codex"]);
  await expect.element(screen.getByText("Claude → ChatGPT")).toBeVisible();

  // The greyed plan has no move controls, only Sign in, and never enters the saved order.
  await expect
    .element(screen.getByRole("button", { name: "Move Antigravity up" }))
    .not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
  expect(onSignIn).toHaveBeenCalledWith("antigravity");
  expect(onSaved.mock.calls.flat(2)).not.toContain("antigravity");
});

it("can't be turned on with a single connected plan", async () => {
  await using screen = await render(
    <Harness initial={[]} providers={[providers[0]!, providers[2]!]} />,
    { router: false },
  );
  await expect
    .element(screen.getByRole("switch", { name: "Switch plans when one runs out" }))
    .toBeDisabled();
});
