import type { ModelCapabilities, ProviderOptionDescriptor } from "@t3tools/contracts";

// A byte-identical copy of atum-desktop's src/matrix/model-picker-labels.json: the agent chats' picker
// and this one show a thinking level, and Atum's own models, in the same words.
import labels from "../../../../atum-work/model-picker-labels.json";

export type PickerLabelLocale = keyof typeof labels.thinking.heading;

const LOCALES = Object.keys(labels.thinking.heading) as PickerLabelLocale[];
const ALIASES: Readonly<Record<string, string>> = labels.thinking.aliases;
const LEVELS: Readonly<Record<string, Readonly<Record<PickerLabelLocale, string>>>> =
  labels.thinking.levels;
const LINEUP: Readonly<Record<string, keyof typeof labels.taglines>> = labels.lineup as Record<
  string,
  keyof typeof labels.taglines
>;

// The ids T3's drivers give the reasoning control when they do not mark it `role: "reasoning"`.
const THINKING_DESCRIPTOR_IDS = new Set(["effort", "reasoningEffort", "reasoning", "variant"]);

/** The labels file's locale for T3's UI locale; anything it does not carry reads in English. */
export function pickerLabelLocale(uiLocale: string): PickerLabelLocale {
  const lower = uiLocale.toLowerCase();
  if (lower.startsWith("zh-hant") || lower === "zh-tw" || lower === "zh-hk") return "zh-hant";
  const base = lower.split("-")[0] ?? "";
  return LOCALES.find((locale) => locale === base) ?? "en";
}

/** A provider's thinking-level id in Atum's words, or undefined to keep the provider's label. */
export function atumThinkingLabel(id: string, locale: PickerLabelLocale): string | undefined {
  const key = id.toLowerCase();
  return LEVELS[ALIASES[key] ?? key]?.[locale];
}

function isThinkingDescriptor(
  descriptor: ProviderOptionDescriptor,
): descriptor is Extract<ProviderOptionDescriptor, { type: "select" }> {
  return (
    descriptor.type === "select" &&
    (descriptor.role === "reasoning" || THINKING_DESCRIPTOR_IDS.has(descriptor.id))
  );
}

/**
 * The model's reasoning control headed and labelled in Atum's words. Display only: option ids, the
 * values sent to the provider, are unchanged, and a level the file does not name keeps its label.
 */
export function withAtumThinkingLabels(
  caps: ModelCapabilities,
  locale: PickerLabelLocale,
): ModelCapabilities {
  const descriptors = caps.optionDescriptors ?? [];
  if (!descriptors.some(isThinkingDescriptor)) return caps;
  return {
    ...caps,
    optionDescriptors: descriptors.map((descriptor) =>
      isThinkingDescriptor(descriptor)
        ? {
            ...descriptor,
            label: labels.thinking.heading[locale],
            options: descriptor.options.map((option) => {
              const label = atumThinkingLabel(option.id, locale);
              return label ? { ...option, label } : option;
            }),
          }
        : descriptor,
    ),
  };
}

/**
 * The muted line after one of Atum's own models, as the agent chats' picker writes it: the everyday
 * model is the suggested one. Only for Atum's instances (`atum-…`); the alias follows the provider
 * prefix in the slug (`atum-managed:nguyet-thuc`).
 */
export function atumModelTagline(
  instanceId: string,
  slug: string,
  locale: PickerLabelLocale,
): string | undefined {
  if (!instanceId.startsWith("atum-")) return undefined;
  const kind = LINEUP[slug.slice(slug.lastIndexOf(":") + 1)];
  if (!kind) return undefined;
  const tagline = labels.taglines[kind][locale];
  return kind === "everyday" ? `${labels.suggested[locale]} · ${tagline}` : tagline;
}
