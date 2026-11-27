import { createModelCapabilities } from "@t3tools/shared/model";
import { describe, expect, it } from "vite-plus/test";

import digests from "../../../../atum-work/model-picker-digests.json";
import labelsText from "../../../../atum-work/model-picker-labels.json?raw";
import specText from "../../../../atum-work/model-picker-spec.json?raw";
import { atumThinkingLabel, pickerLabelLocale, withAtumThinkingLabels } from "./pickerLabels.logic";

const caps = createModelCapabilities({
  optionDescriptors: [
    {
      id: "thought_level",
      label: "Thought level",
      type: "select",
      role: "reasoning",
      currentValue: "xhigh",
      options: [
        { id: "low", label: "Low" },
        { id: "medium", label: "Medium", isDefault: true },
        { id: "xhigh", label: "Extra High" },
        { id: "ultrathink", label: "Ultrathink" },
      ],
    },
    {
      id: "contextWindow",
      label: "Context",
      type: "select",
      options: [{ id: "low", label: "200k" }],
    },
  ],
});

describe("Atum's picker words", () => {
  it("relabels only the reasoning control, keeping every id and unnamed level", () => {
    const [thinking, context] = withAtumThinkingLabels(caps, "en").optionDescriptors ?? [];
    expect(thinking).toMatchObject({ label: "Thinking", currentValue: "xhigh" });
    expect(thinking?.type === "select" && thinking.options).toEqual([
      { id: "low", label: "Quick" },
      { id: "medium", label: "Balanced", isDefault: true },
      { id: "xhigh", label: "Extra thorough" },
      { id: "ultrathink", label: "Ultrathink" },
    ]);
    expect(context).toEqual(caps.optionDescriptors?.[1]);
  });

  it("folds provider spellings and reads unsupported UI locales in English", () => {
    expect(atumThinkingLabel("extra-high", "vi")).toBe("Rất kỹ");
    expect(atumThinkingLabel("Off", "en")).toBe("Off");
    expect(pickerLabelLocale("zh-TW")).toBe("zh-hant");
    expect(pickerLabelLocale("ja")).toBe("ja");
    expect(pickerLabelLocale("fr")).toBe("en");
  });

  it("keeps the shared files atum-desktop holds byte-identical copies of", async () => {
    const sha256 = async (text: string) =>
      Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))),
        (byte) => byte.toString(16).padStart(2, "0"),
      ).join("");
    expect(await sha256(specText)).toBe(digests["model-picker-spec.json"]);
    expect(await sha256(labelsText)).toBe(digests["model-picker-labels.json"]);
  });
});
