import type {
  EnvironmentId,
  ProviderInstanceId,
  ResolvedKeybindingsConfig,
  ServerProvider,
} from "@t3tools/contracts";
import type { ModelPreferences } from "@t3tools/contracts/settings";
import { createContext, use, type ComponentType } from "react";

import type { useComposerDraftStore } from "../../composerDraftStore";
import { workModelPickerHost } from "./workModelPickerHost";

type SetProviderModelOptions = ReturnType<
  typeof useComposerDraftStore.getState
>["setProviderModelOptions"];

/**
 * The state the model picker reads while it renders: Work's server atoms, settings, router and
 * composer draft in Work, a host's own adapters elsewhere (docs/internals/shared-model-picker.md).
 * Each member is a hook called in place of the code it replaced, so a host must be one constant
 * object for the life of the picker.
 */
export interface ModelPickerHost {
  /** Asks for newly released models; the picker calls it on every open. */
  readonly useRefreshModelCatalog: (environmentId: EnvironmentId | null) => () => void;
  /** Opens provider settings from an update notice. */
  readonly useOpenProviderSettings: () => () => void;
  readonly useEnvironmentModelPreferences: (environmentId: EnvironmentId | null) => {
    readonly favorites: ModelPreferences["favorites"];
  };
  readonly useToggleEnvironmentModelFavorite: (
    environmentId: EnvironmentId | null,
  ) => (instanceId: ProviderInstanceId, model: string) => void;
  /** Whether the open provider's catalog for this directory is still being scanned. */
  readonly useProviderWorkspaceSnapshotRefresh: (input: {
    readonly environmentId: EnvironmentId | null;
    readonly gitCwd: string | null;
    readonly instanceId: ProviderInstanceId | undefined;
  }) => { readonly scanning: boolean };
  /** Shortcuts when the caller passes none. */
  readonly useServerKeybindings: () => ResolvedKeybindingsConfig;
  /** Writes an option change for a thread or draft; a host without threads passes no target. */
  readonly useSetProviderModelOptions: () => SetProviderModelOptions;
  /** The row under the list that shares a ChatGPT plan, or nothing. */
  readonly ChatGptSharingControl: ComponentType<{ provider: ServerProvider | null }>;
}

const ModelPickerHostContext = createContext<ModelPickerHost | null>(null);

/** Supplies another host's state to every picker below. Work needs none. */
export const ModelPickerHostProvider = ModelPickerHostContext.Provider;

/** Read at render, not at module load: Work's host imports modules that import the picker. */
function useHost(): ModelPickerHost {
  "use no memo";
  return use(ModelPickerHostContext) ?? workModelPickerHost;
}

// Static hooks for the picker to import, so React Compiler sees the same function every render.
// Each forwards to the host; the forwarders opt out of memoization because their callee is a value.

export function useRefreshModelCatalog(environmentId: EnvironmentId | null) {
  "use no memo";
  return useHost().useRefreshModelCatalog(environmentId);
}

export function useOpenProviderSettings() {
  "use no memo";
  return useHost().useOpenProviderSettings();
}

export function useEnvironmentModelPreferences(environmentId: EnvironmentId | null) {
  "use no memo";
  return useHost().useEnvironmentModelPreferences(environmentId);
}

export function useToggleEnvironmentModelFavorite(environmentId: EnvironmentId | null) {
  "use no memo";
  return useHost().useToggleEnvironmentModelFavorite(environmentId);
}

export function useProviderWorkspaceSnapshotRefresh(
  input: Parameters<ModelPickerHost["useProviderWorkspaceSnapshotRefresh"]>[0],
) {
  "use no memo";
  return useHost().useProviderWorkspaceSnapshotRefresh(input);
}

export function useServerKeybindings() {
  "use no memo";
  return useHost().useServerKeybindings();
}

export function useSetProviderModelOptions() {
  "use no memo";
  return useHost().useSetProviderModelOptions();
}

export function ChatGptSharingControl(props: { provider: ServerProvider | null }) {
  const Control = useHost().ChatGptSharingControl;
  return <Control {...props} />;
}
