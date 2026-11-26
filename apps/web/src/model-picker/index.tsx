/**
 * The model picker's one entry point, for Work's composer and for other hosts such as Atum's
 * desktop chat. The source stays in components/chat, where upstream T3 maintains it; this module
 * only composes it. See docs/internals/shared-model-picker.md.
 */
import {
  DEFAULT_UNIFIED_SETTINGS,
  type ModelSelection,
  type ProviderInstanceId,
  type ServerProvider,
} from "@t3tools/contracts";
import { withImplicitFastModeDefault } from "@t3tools/shared/model";
import { GTProvider } from "gt-react";
import { createContext, use, useMemo } from "react";

import { ComposerEffortColumn } from "../components/chat/ComposerModelEffort";
import { type ModelPickerHost, ModelPickerHostProvider } from "../components/chat/modelPickerHost";
import { ProviderModelPicker } from "../components/chat/ProviderModelPicker";
import type { TraitsSelectionInput } from "../components/chat/TraitsPicker";
import { getCustomModelOptionsByInstance } from "../modelSelection";
import { getProviderModelCapabilities } from "../providerModels";
import { deriveProviderInstanceEntries } from "../providerInstances";

export { ComposerEffortColumn, ComposerPickerFooter } from "../components/chat/ComposerModelEffort";
export { type ModelPickerHost, ModelPickerHostProvider } from "../components/chat/modelPickerHost";
export { ProviderModelPicker } from "../components/chat/ProviderModelPicker";

export interface ModelPickerProps {
  /** The host's provider snapshots, in rail order. */
  readonly providers: ReadonlyArray<ServerProvider>;
  /** The instance, exact model slug and option values in use. */
  readonly selection: ModelSelection;
  /**
   * A model pick or an option change. A model on another instance starts with no options; the
   * same instance keeps its options, as Work's composer does.
   */
  readonly onSelect: (selection: ModelSelection) => void;
  /** Asks the host for a fresh catalog; called on every open. */
  readonly onRefresh?: () => void;
  /** Opens setup for a provider that is not ready. */
  readonly onOpenSetup?: (instanceId: ProviderInstanceId) => void;
  /**
   * UI language, as Work's own I18nProvider passes it. Omit it under a host that already provides
   * GT (Work and its tests); the library entry initializes GT and passes the host's language.
   */
  readonly locale?: string;
  readonly disabled?: boolean;
  readonly triggerClassName?: string;
}

const NO_FAVORITES = { favorites: [] } as const;
const NOT_SCANNING = { scanning: false } as const;
const NO_KEYBINDINGS: ReturnType<ModelPickerHost["useServerKeybindings"]> = [];
const noop = () => {};

const ModelPickerPropsContext = createContext<ModelPickerProps | null>(null);

function useProps(): ModelPickerProps {
  const props = use(ModelPickerPropsContext);
  if (!props) throw new Error("The standalone picker host renders only inside <ModelPicker>.");
  return props;
}

/** One constant host whose hooks read the latest props, so hook order never changes. */
const standaloneHost: ModelPickerHost = {
  useRefreshModelCatalog: () => useProps().onRefresh ?? noop,
  useOpenProviderSettings: () => {
    const { onOpenSetup, selection } = useProps();
    return () => onOpenSetup?.(selection.instanceId);
  },
  useEnvironmentModelPreferences: () => NO_FAVORITES,
  useToggleEnvironmentModelFavorite: () => noop,
  useProviderWorkspaceSnapshotRefresh: () => NOT_SCANNING,
  useServerKeybindings: () => NO_KEYBINDINGS,
  // Options travel through `onModelOptionsChange`; there is no thread or draft to write.
  useSetProviderModelOptions: () => noop,
  ChatGptSharingControl: () => null,
};

/**
 * Work's picker with the options column always docked, driven by one set of props. A model with
 * no options keeps the column and shows "No effort levels".
 */
export function ModelPicker(props: ModelPickerProps) {
  const { providers, selection, onSelect } = props;
  const instanceEntries = useMemo(() => deriveProviderInstanceEntries(providers), [providers]);
  const modelOptionsByInstance = useMemo(
    () =>
      getCustomModelOptionsByInstance(
        DEFAULT_UNIFIED_SETTINGS,
        providers,
        selection.instanceId,
        selection.model,
      ),
    [providers, selection.instanceId, selection.model],
  );
  const entry = instanceEntries.find((candidate) => candidate.instanceId === selection.instanceId);
  const traits: TraitsSelectionInput | null = entry
    ? {
        provider: entry.driverKind,
        instanceId: entry.instanceId,
        models: entry.models,
        model: selection.model,
        modelOptions: withImplicitFastModeDefault(
          getProviderModelCapabilities(entry.models, selection.model, entry.driverKind),
          selection.options,
        ),
        // No prompt here, so no Ultrathink keyword can stand in for a level.
        allowPromptInjectedEffort: false,
        onModelOptionsChange: (options) => onSelect({ ...selection, options: options ?? [] }),
      }
    : null;

  const picker = (
    <ModelPickerPropsContext value={props}>
        <ModelPickerHostProvider value={standaloneHost}>
          <ProviderModelPicker
            environmentId={null}
            activeInstanceId={selection.instanceId}
            model={selection.model}
            lockedProvider={null}
            instanceEntries={instanceEntries}
            modelOptionsByInstance={modelOptionsByInstance}
            {...(props.disabled !== undefined ? { disabled: props.disabled } : {})}
            {...(props.triggerClassName ? { triggerClassName: props.triggerClassName } : {})}
            {...(props.onOpenSetup ? { onOpenProviderSetup: props.onOpenSetup } : {})}
            onInstanceModelChange={(instanceId, model) =>
              onSelect(
                instanceId === selection.instanceId
                  ? { ...selection, model }
                  : { instanceId, model, options: [] },
              )
            }
            effortColumn={<ComposerEffortColumn traits={traits} />}
          />
        </ModelPickerHostProvider>
    </ModelPickerPropsContext>
  );
  return props.locale ? <GTProvider locale={props.locale}>{picker}</GTProvider> : picker;
}
