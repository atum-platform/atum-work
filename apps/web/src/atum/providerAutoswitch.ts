import {
  ServerSettings,
  type ProviderInstanceId,
  type ServerSettingsPatch,
} from "@t3tools/contracts";
import type { ProviderInstanceEntry } from "../providerInstances";
import {
  isAutoswitchConnected,
  type AutoswitchProvider,
  type ProviderFallbackStateView,
} from "./providerAutoswitch.logic";

/**
 * Seam to the autoswitch engine contract (docs/internals/work-provider-fallback.md): account and
 * thread `providerFallbackOrder` ([] off, null inherits) and the shell's `providerFallbackState`.
 * Reads are structural and every surface checks `providerAutoswitchAvailable`.
 */
export const providerAutoswitchAvailable = "providerFallbackOrder" in ServerSettings.fields;

function idList(value: unknown): ReadonlyArray<ProviderInstanceId> | null {
  return Array.isArray(value) && value.every((id) => typeof id === "string")
    ? (value as unknown as ReadonlyArray<ProviderInstanceId>)
    : null;
}

const NO_ORDER: ReadonlyArray<ProviderInstanceId> = [];

export function accountFallbackOrder(settings: object): ReadonlyArray<ProviderInstanceId> {
  return (
    idList((settings as { providerFallbackOrder?: unknown }).providerFallbackOrder) ?? NO_ORDER
  );
}

export function accountFallbackOrderPatch(
  order: ReadonlyArray<ProviderInstanceId>,
): ServerSettingsPatch {
  return { providerFallbackOrder: order } as ServerSettingsPatch;
}

/** The thread's override. Undefined or null follows the account. */
export function threadFallbackOrder(
  shell: object | null,
): ReadonlyArray<ProviderInstanceId> | null {
  if (shell === null) return null;
  return idList((shell as { providerFallbackOrder?: unknown }).providerFallbackOrder);
}

export function threadFallbackState(shell: object | null): ProviderFallbackStateView | null {
  if (shell === null) return null;
  const state = (shell as { providerFallbackState?: unknown }).providerFallbackState;
  if (typeof state !== "object" || state === null) return null;
  const value = state as Record<string, unknown>;
  if (typeof value.activeProvider !== "string" || typeof value.preferredProvider !== "string") {
    return null;
  }
  return {
    activeProvider: value.activeProvider as ProviderInstanceId,
    preferredProvider: value.preferredProvider as ProviderInstanceId,
    exhaustedUntil: typeof value.exhaustedUntil === "string" ? value.exhaustedUntil : null,
    reason: value.reason === "usage_limit" ? "usage_limit" : null,
    canContinue: value.canContinue === true,
  };
}

/** The `thread.metadata.update` fields that set a session override. */
export function threadFallbackOrderInput(
  order: ReadonlyArray<ProviderInstanceId> | null,
): Record<string, never> {
  return { providerFallbackOrder: order } as unknown as Record<string, never>;
}

export function autoswitchProviders(
  entries: ReadonlyArray<ProviderInstanceEntry>,
): ReadonlyArray<AutoswitchProvider> {
  return entries.map((entry) => ({
    instanceId: entry.instanceId,
    driverKind: entry.driverKind,
    name: entry.displayName,
    connected: isAutoswitchConnected(entry.snapshot),
    isDefault: entry.isDefault,
  }));
}
