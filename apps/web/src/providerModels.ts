import {
  DEFAULT_MODEL,
  DEFAULT_MODEL_BY_PROVIDER,
  defaultInstanceIdForDriver,
  ProviderDriverKind,
  type ModelCapabilities,
  type ProviderInstanceId,
  type ServerProvider,
  type ServerProviderModel,
} from "@t3tools/contracts";
import { createModelCapabilities, resolveSelectableModel } from "@t3tools/shared/model";
import { pickerLabelLocale, withAtumThinkingLabels } from "./atum/pickerLabels.logic";
import { getActiveLocale } from "./i18n/messages";

const EMPTY_CAPABILITIES: ModelCapabilities = createModelCapabilities({
  optionDescriptors: [],
});
const DEFAULT_DRIVER_KIND = ProviderDriverKind.make("codex");
const RUNTIME_MODEL_CATALOG_DRIVERS: ReadonlySet<string> = new Set([
  "opencode",
  "antigravity",
  "cursor",
  "pi",
  "acpRegistry",
]);

// These drivers discover models at runtime, so a refresh can briefly omit a model the user chose.
export function hasRuntimeModelCatalog(provider: ProviderDriverKind): boolean {
  return RUNTIME_MODEL_CATALOG_DRIVERS.has(provider);
}

// These markers follow the session's current model rather than naming an unavailable model.
export function isRuntimeModelDefaultAlias(
  provider: ProviderDriverKind,
  model: string | null | undefined,
): boolean {
  return (
    (provider === "antigravity" || provider === "acpRegistry") &&
    model === DEFAULT_MODEL_BY_PROVIDER[provider]
  );
}

// Antigravity lists its default model only as an alias, which a slug lookup would call missing.
export function keepsUnavailableModelOptions(
  provider: ProviderDriverKind,
  model: string | null | undefined,
): boolean {
  return (
    provider !== "antigravity" &&
    !isRuntimeModelDefaultAlias(provider, model) &&
    hasRuntimeModelCatalog(provider)
  );
}

export function formatProviderDriverKindLabel(provider: ProviderDriverKind): string {
  return provider
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function getProviderModels(
  providers: ReadonlyArray<ServerProvider>,
  provider: ProviderDriverKind,
): ReadonlyArray<ServerProviderModel> {
  return getProviderSnapshot(providers, provider)?.models ?? [];
}

function getProviderSnapshot(
  providers: ReadonlyArray<ServerProvider>,
  provider: ProviderDriverKind,
): ServerProvider | undefined {
  const defaultInstanceId = defaultInstanceIdForDriver(provider);
  return providers.find((candidate) => candidate.instanceId === defaultInstanceId);
}

export function resolveSelectableProvider(
  providers: ReadonlyArray<ServerProvider>,
  provider: ProviderDriverKind | ProviderInstanceId | null | undefined,
): ProviderDriverKind {
  const requestedEntry = providers.find((candidate) => candidate.instanceId === provider);
  if (requestedEntry?.enabled) {
    return requestedEntry.driver;
  }
  return providers.find((candidate) => candidate.enabled)?.driver ?? DEFAULT_DRIVER_KIND;
}

export function getProviderModelCapabilities(
  models: ReadonlyArray<ServerProviderModel>,
  model: string | null | undefined,
  provider: ProviderDriverKind,
  includePlanAgent = false,
): ModelCapabilities {
  const slug = resolveSelectableModel(provider, model, models);
  const selectedModel = models.find((candidate) => candidate.slug === slug);
  const caps = atumThinkingWords(selectedModel?.capabilities ?? EMPTY_CAPABILITIES);
  if (includePlanAgent) {
    return caps;
  }
  return withoutPlanAgentOption(caps);
}

// Atum builds show thinking levels in the words Atum's agent chats use; the ids sent stay the provider's.
function atumThinkingWords(caps: ModelCapabilities): ModelCapabilities {
  return import.meta.env.VITE_ATUM_WORK_BUILD === "1"
    ? withAtumThinkingLabels(caps, pickerLabelLocale(getActiveLocale()))
    : caps;
}

function withoutPlanAgentOption(caps: ModelCapabilities): ModelCapabilities {
  return {
    ...caps,
    optionDescriptors: (caps.optionDescriptors ?? []).flatMap((descriptor) => {
      if (descriptor.type !== "select" || descriptor.id !== "agent") {
        return [descriptor];
      }
      const options = descriptor.options.filter((option) => option.id !== "plan");
      if (options.length === 0) {
        return [];
      }
      const currentValue =
        descriptor.currentValue && options.some((option) => option.id === descriptor.currentValue)
          ? descriptor.currentValue
          : (options.find((option) => option.isDefault)?.id ?? options[0]?.id);
      return [{ ...descriptor, options, ...(currentValue ? { currentValue } : {}) }];
    }),
  };
}

export function getDefaultServerModel(
  providers: ReadonlyArray<ServerProvider>,
  provider: ProviderDriverKind,
): string {
  const models = getProviderModels(providers, provider);
  return (
    models.find((model) => model.isDefault && !model.isCustom)?.slug ??
    models.find((model) => !model.isCustom)?.slug ??
    models[0]?.slug ??
    DEFAULT_MODEL_BY_PROVIDER[provider] ??
    DEFAULT_MODEL
  );
}
