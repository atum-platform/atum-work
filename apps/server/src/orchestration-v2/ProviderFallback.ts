import {
  type ModelSelection,
  type OrchestrationV2AppThread,
  type OrchestrationV2ConversationMessage,
  type OrchestrationV2ThreadShell,
  type ProviderFallbackState,
  type ProviderInstanceId,
  type ServerProvider,
  type ServerSettings,
} from "@t3tools/contracts";
import { modelSelectionsEqual } from "@t3tools/shared/model";
import { applicableUsageWindows, exhaustedUsageWindows } from "@t3tools/shared/usageLimits";
import * as Effect from "effect/Effect";

type ExhaustedUntil = ProviderFallbackState["exhaustedUntil"];
export interface ProviderQuotaFailure {
  readonly resetAt: string | null;
  readonly observedAt: string;
}

const SUPPORTED_DRIVERS = new Set(["codex", "claudeAgent", "antigravity", "opencode"]);
export const CONTINUABLE_WORK_ITEM_TYPES = [
  "command_execution",
  "file_change",
  "dynamic_tool",
  "subagent",
] as const;
const isGo = (model: string) => model.startsWith("opencode-go/");

export function workFallbackOrder(
  settings: ServerSettings,
  thread: Pick<
    OrchestrationV2AppThread,
    "projectId" | "providerFallbackOrder" | "lineage" | "creationSource"
  >,
): ReadonlyArray<ProviderInstanceId> {
  const surface =
    settings.projectSettingsOverrides[thread.projectId]?.atumSurfaceMode ??
    settings.atumSurfaceMode;
  return surface === "work" &&
    thread.lineage.relationshipToParent !== "subagent" &&
    (thread.creationSource === "web" || thread.creationSource === "mobile")
    ? (thread.providerFallbackOrder ?? settings.providerFallbackOrder)
    : [];
}

export function isInteractiveFallbackMessage(
  message: Pick<
    OrchestrationV2ConversationMessage,
    "createdBy" | "creationSource" | "scheduledTaskId" | "text" | "attachments" | "context"
  >,
) {
  return (
    message.createdBy === "user" &&
    (message.creationSource === "web" || message.creationSource === "mobile") &&
    message.scheduledTaskId === undefined &&
    !message.text.trimStart().startsWith("/") &&
    message.attachments.length === 0 &&
    (message.context === undefined ||
      (message.context.guest === undefined && message.context.records.length === 0))
  );
}

const isSupportedRoute = (provider: ServerProvider, model: string) =>
  SUPPORTED_DRIVERS.has(provider.driver) && (provider.driver !== "opencode" || isGo(model));

const isConnected = (provider: ServerProvider) =>
  provider.enabled &&
  provider.installed &&
  provider.status === "ready" &&
  provider.availability !== "unavailable" &&
  provider.auth.status === "authenticated";

export function quotaExhaustedUntil(
  provider: ServerProvider,
  model: string,
  failure: ProviderQuotaFailure | undefined,
  nowMs: number,
): ExhaustedUntil {
  const limits = provider.usageLimits;
  const observedAt = failure === undefined ? 0 : Date.parse(failure.observedAt);
  // A failed probe may retain old bars under a newer checkedAt.
  const freshUsage =
    limits !== undefined &&
    limits.unavailable === undefined &&
    Date.parse(limits.checkedAt) >= observedAt &&
    Date.parse(limits.checkedAt) <= nowMs;
  const exhausted = exhaustedUsageWindows(provider, nowMs, model).filter(
    (window) =>
      window.resetsAt !== undefined ||
      (freshUsage && nowMs - Date.parse(limits.checkedAt) < 5 * 60_000),
  );
  const resets = exhausted.map((window) => window.resetsAt ?? "unknown");
  if (failure !== undefined) {
    const resetMs = failure.resetAt === null ? NaN : Date.parse(failure.resetAt);
    const healthyUsage =
      freshUsage &&
      Date.parse(limits.checkedAt) > observedAt &&
      exhausted.length === 0 &&
      applicableUsageWindows(provider, model).some(
        (window) =>
          window.usedPercent < 100 &&
          (window.resetsAt === undefined || Date.parse(window.resetsAt) > nowMs),
      );
    if (!healthyUsage) {
      if (!Number.isFinite(resetMs) || resetMs <= observedAt) resets.push("unknown");
      else if (resetMs > nowMs && failure.resetAt !== null) resets.push(failure.resetAt);
    }
  }
  return resets.includes("unknown")
    ? "unknown"
    : (resets.toSorted((a, b) => Date.parse(a) - Date.parse(b)).at(-1) ?? null);
}

export interface ProviderFallbackDecision {
  readonly selection: ModelSelection;
  readonly preference: NonNullable<OrchestrationV2AppThread["providerFallback"]>;
  readonly blocked: boolean;
}

export const selectProviderFallback = Effect.fn("ProviderFallback.select")(function* <E>(input: {
  readonly settings: ServerSettings;
  readonly thread: OrchestrationV2AppThread;
  readonly requested: ModelSelection;
  readonly order: ReadonlyArray<ProviderInstanceId>;
  readonly nowMs: number;
  readonly snapshot: (id: ProviderInstanceId) => Effect.Effect<ServerProvider | undefined>;
  readonly latestFailure: (
    selection: ModelSelection,
    shareGoQuota: boolean,
  ) => Effect.Effect<ProviderQuotaFailure | undefined, E>;
}) {
  if (input.order.length === 0) return undefined;
  const { thread, requested, settings, snapshot } = input;
  const preferred = modelSelectionsEqual(thread.modelSelection, requested)
    ? (thread.providerFallback?.preferredSelection ?? requested)
    : requested;
  const primary = yield* snapshot(preferred.instanceId);
  if (!primary || !isSupportedRoute(primary, preferred.model)) return undefined;
  const exhaustion = (provider: ServerProvider, selection: ModelSelection) =>
    input
      .latestFailure(selection, provider.driver === "opencode")
      .pipe(
        Effect.map((failure) =>
          quotaExhaustedUntil(provider, selection.model, failure, input.nowMs),
        ),
      );
  const exhaustedUntil = yield* exhaustion(primary, preferred);
  const preference = { preferredSelection: preferred, exhaustedUntil };
  const eligible = (provider: ServerProvider) =>
    isConnected(provider) &&
    settings.projectSettingsOverrides[thread.projectId]?.providerInstances?.[provider.instanceId]
      ?.enabled !== false &&
    (provider.supportedRuntimeModes?.includes(thread.runtimeMode) ?? true);
  if (exhaustedUntil === null) {
    const preferredModelAvailable = primary.models.some(
      (model) => model.slug === preferred.model || model.aliases?.includes(preferred.model),
    );
    return {
      selection:
        preferred.instanceId === requested.instanceId ||
        (eligible(primary) && preferredModelAvailable)
          ? preferred
          : requested,
      preference,
      blocked: false,
    };
  }

  const drivers = new Set([primary.driver]);
  for (const instanceId of input.order) {
    const provider = yield* snapshot(instanceId);
    if (!provider || drivers.has(provider.driver)) continue;
    drivers.add(provider.driver);
    if (!eligible(provider)) continue;
    const models = provider.models.filter(
      (model) =>
        !model.isLegacy &&
        !model.isCustom &&
        isSupportedRoute(provider, model.slug) &&
        !provider.subProviders?.some(
          (sub) => sub.name === model.subProvider && sub.unavailableReason,
        ),
    );
    const model = models.find((entry) => entry.isDefault) ?? models[0];
    if (model === undefined) continue;
    const selection = { instanceId, model: model.slug };
    if ((yield* exhaustion(provider, selection)) === null) {
      return { selection, preference, blocked: false };
    }
  }
  return { selection: requested, preference, blocked: true };
});

export function providerFallbackShellFields(
  thread: OrchestrationV2AppThread,
  summary: Pick<
    OrchestrationV2ThreadShell,
    "status" | "lastErrorClass" | "usageLimitResetAt" | "pendingRuntimeRequest" | "activeRunId"
  >,
  performedWork: boolean,
) {
  const preference = thread.providerFallback;
  const limited = summary.status === "failed" && summary.lastErrorClass === "usage_limit";
  const exhaustedUntil =
    limited &&
    (preference == null || preference.preferredSelection.instanceId === thread.providerInstanceId)
      ? (summary.usageLimitResetAt ?? "unknown")
      : (preference?.exhaustedUntil ?? null);
  const state: ProviderFallbackState = {
    activeProvider: thread.providerInstanceId,
    preferredProvider: preference?.preferredSelection.instanceId ?? thread.providerInstanceId,
    exhaustedUntil,
    reason: exhaustedUntil !== null || limited ? "usage_limit" : null,
    canContinue:
      limited &&
      performedWork &&
      summary.activeRunId === null &&
      summary.pendingRuntimeRequest === null &&
      thread.archivedAt === null &&
      thread.deletedAt === null &&
      thread.settledOverride !== "settled",
  };
  return {
    ...(thread.providerFallbackOrder === undefined
      ? {}
      : { providerFallbackOrder: thread.providerFallbackOrder }),
    ...(preference == null && !limited ? {} : { providerFallbackState: state }),
  };
}
