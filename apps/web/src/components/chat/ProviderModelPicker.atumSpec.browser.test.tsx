import {
  ProviderDriverKind,
  ProviderInstanceId,
  type ProviderOptionSelection,
  type ServerProviderModel,
} from "@t3tools/contracts";
import { createModelCapabilities } from "@t3tools/shared/model";
import { useState } from "react";
import { expect, it, vi } from "vite-plus/test";
import { page } from "vite-plus/test/browser";

import "~/index.css";

// Atum's agent chats draw the same picker from this spec (atum-desktop src/matrix/model-picker-spec.json,
// a byte-identical copy). When an upstream sync moves T3's picker, this fails: update both copies.
import spec from "../../../../../atum-work/model-picker-spec.json";
import { render } from "../../../test/render";
import { deriveProviderInstanceEntries } from "../../providerInstances";
import { ComposerEffortColumn } from "./ComposerModelEffort";
import { ProviderModelPicker } from "./ProviderModelPicker";

const capabilities = createModelCapabilities({
  optionDescriptors: [
    {
      id: "effort",
      label: "Thinking",
      type: "select",
      role: "reasoning",
      currentValue: "medium",
      options: [
        { id: "low", label: "Low" },
        { id: "medium", label: "Medium" },
      ],
    },
  ],
});
const models: ServerProviderModel[] = [
  { slug: "first", name: "First model", isCustom: false, capabilities },
  { slug: "second", name: "Second model", isCustom: false, capabilities },
];
const entries = deriveProviderInstanceEntries(
  ["codex", "claudeAgent"].map((driver) => ({
    instanceId: ProviderInstanceId.make(driver),
    driver: ProviderDriverKind.make(driver),
    enabled: true,
    installed: true,
    version: null,
    status: "ready" as const,
    auth: { status: "authenticated" as const },
    checkedAt: "2026-01-01T00:00:00.000Z",
    models,
    slashCommands: [],
    skills: [],
  })),
);
const options = new Map(entries.map((entry) => [entry.instanceId, entry.models]));

function Picker() {
  const [model, setModel] = useState("first");
  const [modelOptions, setModelOptions] = useState<ReadonlyArray<ProviderOptionSelection>>([]);
  const instanceId = entries[0]!.instanceId;
  return (
    <ProviderModelPicker
      environmentId={null}
      activeInstanceId={instanceId}
      model={model}
      lockedProvider={null}
      instanceEntries={entries}
      modelOptionsByInstance={options}
      triggerAriaLabel="Choose model"
      onInstanceModelChange={(_, selected) => setModel(selected)}
      effortColumn={
        <ComposerEffortColumn
          traits={{
            provider: entries[0]!.driverKind,
            instanceId,
            models,
            model,
            modelOptions,
            onModelOptionsChange: (next) => setModelOptions(next ?? []),
          }}
        />
      }
    />
  );
}

const box = (selector: string) => {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`missing ${selector}`);
  return element.getBoundingClientRect();
};

it("keeps the measures Atum's agent-chat picker shares with it", async () => {
  await page.viewport(1100, 720); // the desktop layout: below sm, T3 grows rows for touch
  await using screen = await render(<Picker />, { router: false }); // a bare picker, no routes
  await expect.element(screen.getByRole("button", { name: "Choose model" })).toBeVisible();
  expect(box("[data-chat-provider-model-picker]").height).toBe(spec.trigger.height);

  await screen.getByRole("button", { name: "Choose model" }).click();
  await expect.element(page.getByPlaceholder("Search models...")).toHaveFocus();

  // The popup scales in as it opens: measure once it has settled.
  await vi.waitFor(() => {
    const rail = box("[data-model-picker-sidebar]");
    const railItem = box('[data-model-picker-provider="codex"] button');
    const indicator = box("[data-model-picker-selected-indicator]");
    expect(rail.width).toBe(spec.rail.width);
    expect(railItem.width).toBe(spec.rail.item);
    expect(box('[data-model-picker-provider="codex"] button svg').width).toBe(spec.rail.icon);
    expect([indicator.width, indicator.height]).toEqual([
      spec.rail.indicatorWidth,
      spec.rail.indicatorHeight,
    ]);
    expect(rail.right - indicator.right).toBe(spec.rail.indicatorInset);
    expect(box('input[placeholder="Search models..."]').height).toBe(spec.search.height);
    expect(box('[data-slot="combobox-item"]').height).toBe(spec.row.height);
    expect(box('[data-slot="combobox-item"] svg').width).toBe(spec.row.mark);
    expect(box("[data-model-picker-content]").width).toBe(spec.rail.width + spec.card.listWidth);
    expect(box("[data-model-picker-effort]").width).toBe(spec.card.effortWidth);
    expect(box("[data-model-picker-effort]").height).toBe(spec.card.bodyHeight);
  });
});
