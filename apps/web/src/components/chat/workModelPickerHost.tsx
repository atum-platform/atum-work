import { RegistryContext, useAtomValue } from "@effect/atom-react";
import type { EnvironmentId } from "@t3tools/contracts";
import { useNavigate } from "@tanstack/react-router";
import { useContext } from "react";

import { useComposerDraftStore } from "../../composerDraftStore";
import {
  useEnvironmentModelPreferences,
  useToggleEnvironmentModelFavorite,
} from "../../hooks/useSettings";
import { primaryServerKeybindingsAtom, serverEnvironment } from "../../state/server";
import { useAtomCommand } from "../../state/use-atom-command";
import { ChatGptSharingControl } from "./ChatGptSharingControl";
import type { ModelPickerHost } from "./modelPickerHost";
import { useProviderWorkspaceSnapshotRefresh } from "./useProviderWorkspaceSnapshotRefresh";

function useRefreshModelCatalog(environmentId: EnvironmentId | null) {
  const registry = useContext(RegistryContext);
  const refreshProviders = useAtomCommand(serverEnvironment.refreshProviders, {
    reportFailure: false,
  });
  return () => {
    if (environmentId === null) return;
    // An older server drops the field and probes every provider.
    const config = registry.get(serverEnvironment.configValueAtom(environmentId));
    if (config?.environment.capabilities.modelCatalogRefresh !== true) return;
    void refreshProviders({ environmentId, input: { modelCatalogOnly: true } });
  };
}

function useOpenProviderSettings() {
  const navigate = useNavigate();
  return () => void navigate({ to: "/settings/providers" });
}

/** Work's own state behind the picker. The library build replaces this module with a stub. */
export const workModelPickerHost: ModelPickerHost = {
  useRefreshModelCatalog,
  useOpenProviderSettings,
  useEnvironmentModelPreferences,
  useToggleEnvironmentModelFavorite,
  useProviderWorkspaceSnapshotRefresh,
  useServerKeybindings: () => useAtomValue(primaryServerKeybindingsAtom),
  useSetProviderModelOptions: () => useComposerDraftStore((store) => store.setProviderModelOptions),
  ChatGptSharingControl,
};
