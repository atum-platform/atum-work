import type { ProviderDriverKind, ProviderInstanceId } from "@t3tools/contracts";

/**
 * Provider autoswitch chrome as pure functions; the engine owns the switch. Owner rules: no
 * fallback cost, greyed unavailable plans with one action, status in composer chrome only, one
 * line and at most one action.
 */

/** Drivers the engine can switch between: Codex, Claude, Antigravity and OpenCode Go. */
const AUTOSWITCH_DRIVERS: ReadonlySet<string> = new Set([
  "codex",
  "claudeAgent",
  "antigravity",
  "opencode",
]);

export function isAutoswitchDriver(driverKind: string): boolean {
  return AUTOSWITCH_DRIVERS.has(driverKind);
}

/** The engine's own connected rule (ProviderFallback `isConnected`), read from a provider snapshot. */
export function isAutoswitchConnected(snapshot: {
  readonly enabled: boolean;
  readonly installed: boolean;
  readonly status: string;
  readonly availability?: string | undefined;
  readonly auth: { readonly status: string };
}): boolean {
  return (
    snapshot.enabled &&
    snapshot.installed &&
    snapshot.status === "ready" &&
    snapshot.availability !== "unavailable" &&
    snapshot.auth.status === "authenticated"
  );
}

export interface AutoswitchProvider {
  readonly instanceId: ProviderInstanceId;
  readonly driverKind: ProviderDriverKind;
  readonly name: string;
  readonly connected: boolean;
  readonly isDefault: boolean;
}

/** The engine's per-thread state (`ProviderFallbackState` in the orchestration contract). */
export interface ProviderFallbackStateView {
  readonly activeProvider: ProviderInstanceId;
  readonly preferredProvider: ProviderInstanceId;
  /** An ISO time, "unknown" when the provider reported no reset, or null when not exhausted. */
  readonly exhaustedUntil: string | null;
  readonly reason: "usage_limit" | null;
  readonly canContinue: boolean;
}

export interface FallbackOrderRow {
  readonly instanceId: ProviderInstanceId;
  readonly name: string;
  readonly driverKind: ProviderDriverKind;
  readonly connected: boolean;
}

/**
 * The rows of the settings list. Saved, connected plans come first in their saved order. Any
 * connected plan that isn't saved yet follows. Plans that aren't connected come last; they are
 * greyed and never get a turn.
 */
export function fallbackOrderRows(
  order: ReadonlyArray<ProviderInstanceId>,
  providers: ReadonlyArray<AutoswitchProvider>,
): ReadonlyArray<FallbackOrderRow> {
  const eligible = providers.filter((provider) => isAutoswitchDriver(provider.driverKind));
  const byId = new Map(eligible.map((provider) => [provider.instanceId, provider]));
  const saved = order.flatMap((id) => {
    const provider = byId.get(id);
    return provider?.connected ? [provider] : [];
  });
  const savedIds = new Set(saved.map((provider) => provider.instanceId));
  const unsaved = defaultConnectedOrder(eligible).flatMap((id) =>
    savedIds.has(id) ? [] : [byId.get(id)!],
  );
  const disconnected = eligible.filter((provider) => !provider.connected);
  return [...saved, ...unsaved, ...disconnected].map((provider) => ({
    instanceId: provider.instanceId,
    name: provider.name,
    driverKind: provider.driverKind,
    connected: provider.connected,
  }));
}

/** Connected, switchable plans with the default provider first. Used when an order is first made. */
export function defaultConnectedOrder(
  providers: ReadonlyArray<AutoswitchProvider>,
): ReadonlyArray<ProviderInstanceId> {
  const connected = providers.filter(
    (provider) => provider.connected && isAutoswitchDriver(provider.driverKind),
  );
  return [
    ...connected.filter((provider) => provider.isDefault),
    ...connected.filter((provider) => !provider.isDefault),
  ].map((provider) => provider.instanceId);
}

/** The order to save after moving one connected row. Greyed rows never enter the saved order. */
export function moveInFallbackOrder(
  rows: ReadonlyArray<FallbackOrderRow>,
  instanceId: ProviderInstanceId,
  steps: number,
): ReadonlyArray<ProviderInstanceId> {
  const ids = rows.filter((row) => row.connected).map((row) => row.instanceId);
  const from = ids.indexOf(instanceId);
  if (from === -1) return ids;
  const to = Math.max(0, Math.min(ids.length - 1, from + steps));
  const next = [...ids];
  next.splice(to, 0, ...next.splice(from, 1));
  return next;
}

/** Whether this session switches. A thread order of null follows the account; [] means stay. */
export function sessionSwitches(
  threadOrder: ReadonlyArray<ProviderInstanceId> | null | undefined,
  accountOrder: ReadonlyArray<ProviderInstanceId>,
): boolean {
  return (threadOrder ?? accountOrder).length > 0;
}

/**
 * The thread override to save for a session choice. Choosing what the account already does saves
 * no override (null), so a later account change still reaches this session.
 */
export function sessionOverrideFor(
  switches: boolean,
  accountOrder: ReadonlyArray<ProviderInstanceId>,
  connectedOrder: ReadonlyArray<ProviderInstanceId>,
): ReadonlyArray<ProviderInstanceId> | null {
  if (switches === accountOrder.length > 0) return null;
  return switches ? connectedOrder : [];
}

export type ComposerAutoswitchLine =
  /** A fallback is answering this session. */
  | {
      readonly kind: "switched";
      readonly out: string;
      readonly using: string;
      readonly until: string | null;
    }
  /** The plan just ran out; the next message goes to the next plan. */
  | {
      readonly kind: "next";
      readonly out: string;
      readonly using: string;
      readonly until: string | null;
    }
  /** The plan ran out during a run that may have done work; Continue picks it up on the next plan. */
  | { readonly kind: "continue"; readonly out: string; readonly using: string };

/**
 * The composer's one line. Null when nothing switched or will switch: the plan answered, the
 * session was switched back after the reset (silent), or no plan is left (the existing usage-limit
 * banner owns that state).
 */
export function composerAutoswitchLine(input: {
  readonly state: ProviderFallbackStateView | null;
  readonly order: ReadonlyArray<ProviderInstanceId>;
  readonly providers: ReadonlyArray<AutoswitchProvider>;
  readonly canResume: boolean;
}): ComposerAutoswitchLine | null {
  const { state, providers } = input;
  if (state === null || state.reason !== "usage_limit") return null;
  const byId = new Map(providers.map((provider) => [provider.instanceId, provider]));
  const preferred = byId.get(state.preferredProvider);
  if (preferred === undefined) return null;
  const until =
    state.exhaustedUntil === null || state.exhaustedUntil === "unknown"
      ? null
      : state.exhaustedUntil;
  if (state.activeProvider !== state.preferredProvider) {
    const active = byId.get(state.activeProvider);
    return active ? { kind: "switched", out: preferred.name, using: active.name, until } : null;
  }
  const next = nextFallbackProvider(preferred, input.order, byId);
  if (next === null) return null;
  return state.canContinue && input.canResume
    ? { kind: "continue", out: preferred.name, using: next.name }
    : { kind: "next", out: preferred.name, using: next.name, until };
}

/** Mirrors the engine's walk: the first connected plan in order from another driver. */
function nextFallbackProvider(
  preferred: AutoswitchProvider,
  order: ReadonlyArray<ProviderInstanceId>,
  byId: ReadonlyMap<ProviderInstanceId, AutoswitchProvider>,
): AutoswitchProvider | null {
  const drivers = new Set([preferred.driverKind]);
  for (const id of order) {
    const provider = byId.get(id);
    if (provider === undefined || drivers.has(provider.driverKind)) continue;
    drivers.add(provider.driverKind);
    if (provider.connected && isAutoswitchDriver(provider.driverKind)) return provider;
  }
  return null;
}
