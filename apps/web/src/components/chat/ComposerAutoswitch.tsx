import type { EnvironmentId, ProviderInstanceId, ScopedThreadRef } from "@t3tools/contracts";
import { thrownErrorMessage } from "@t3tools/client-runtime/errors";
import { squashAtomCommandFailure } from "@t3tools/client-runtime/state/runtime";
import { useGT } from "gt-react";
import { m } from "~/i18n/messages";

import {
  accountFallbackOrder,
  autoswitchProviders,
  providerAutoswitchAvailable,
  threadFallbackOrder,
  threadFallbackOrderInput,
  threadFallbackState,
} from "../../atum/providerAutoswitch";
import {
  type ComposerAutoswitchLine,
  composerAutoswitchLine,
  defaultConnectedOrder,
  sessionOverrideFor,
  sessionSwitches,
} from "../../atum/providerAutoswitch.logic";
import { useActiveAtumSurfaceMode } from "../../atum/surfaceMode";
import { useClientSettings, useEnvironmentSettings } from "../../hooks/useSettings";
import type { ProviderInstanceEntry } from "../../providerInstances";
import { useThreadShell } from "../../state/entities";
import { threadEnvironment } from "../../state/threads";
import { useOrchestrationCommand } from "../../state/use-orchestration-command";
import { formatUpcomingTimestamp } from "../../timestampFormat";
import { Button } from "../ui/button";
import { toastManager } from "../ui/toast";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { FOOTER_SEGMENT } from "./ComposerModelEffort";

interface AutoswitchScope {
  readonly environmentId: EnvironmentId;
  /** Null for a draft: a session override needs a thread. */
  readonly threadRef: ScopedThreadRef | null;
  readonly instanceEntries: ReadonlyArray<ProviderInstanceEntry>;
}

/** What the composer needs to draw autoswitch chrome, or null when it has none to draw. */
function useAutoswitchScope({ environmentId, threadRef, instanceEntries }: AutoswitchScope) {
  const work = useActiveAtumSurfaceMode() === "work";
  const shell = useThreadShell(providerAutoswitchAvailable && work ? threadRef : null);
  const accountOrder = useEnvironmentSettings(environmentId, accountFallbackOrder);
  if (!providerAutoswitchAvailable || !work) return null;
  const threadOrder = threadFallbackOrder(shell);
  return {
    shell,
    accountOrder,
    threadOrder,
    order: threadOrder ?? accountOrder,
    providers: autoswitchProviders(instanceEntries),
  };
}

/** The words of the composer's one line. No cost, no Proton, no provider jargon. */
function useAutoswitchLineText(): (line: ComposerAutoswitchLine) => string {
  const gt = useGT();
  const timestampFormat = useClientSettings((settings) => settings.timestampFormat);
  const at = (iso: string) => formatUpcomingTimestamp(iso, timestampFormat);
  return (line) => {
    switch (line.kind) {
      case "switched":
        return line.until
          ? gt("{out} is out until {time} · using {using}", {
              out: line.out,
              time: at(line.until),
              using: line.using,
            })
          : gt("{out} is out · using {using}", { out: line.out, using: line.using });
      case "next":
        return line.until
          ? gt("{out} is out until {time} · {using} answers next", {
              out: line.out,
              time: at(line.until),
              using: line.using,
            })
          : gt("{out} is out · {using} answers next", { out: line.out, using: line.using });
      case "continue":
        return gt("{out} ran out mid-reply", { out: line.out });
    }
  };
}

/**
 * One quiet line beside the model chip when the engine switched plans or will on the next message,
 * with Continue after a cut-off run. It draws nothing when the plan answered, after the silent switch
 * back, or when no plan is left (the usage-limit banner owns that).
 */
export function ComposerAutoswitchStatus(
  props: AutoswitchScope & {
    /** The native resume (T3 manual continuation) and whether it may run now. */
    readonly canResume: boolean;
    readonly onResume: () => void;
  },
) {
  const scope = useAutoswitchScope(props);
  if (scope === null) return null;
  const line = composerAutoswitchLine({
    state: threadFallbackState(scope.shell),
    order: scope.order,
    providers: scope.providers,
    canResume: props.canResume,
  });
  return line === null ? null : (
    <ComposerAutoswitchLineView line={line} onResume={props.onResume} />
  );
}

/** One line, and Continue only after a cut-off run. */
export function ComposerAutoswitchLineView(props: {
  readonly line: ComposerAutoswitchLine;
  readonly onResume: () => void;
}) {
  const gt = useGT();
  const text = useAutoswitchLineText();
  const { line } = props;
  const words = text(line);
  return (
    <span data-composer-autoswitch={line.kind} className="flex min-w-0 shrink items-center gap-2">
      <Tooltip>
        <TooltipTrigger
          render={<span className="min-w-0 truncate text-xs text-muted-foreground" />}
        >
          {words}
        </TooltipTrigger>
        <TooltipPopup side="top">{words}</TooltipPopup>
      </Tooltip>
      {line.kind === "continue" ? (
        <Button
          type="button"
          size="xs"
          variant="secondary"
          className="shrink-0"
          aria-label={gt("Continue with {model}", { model: line.using })}
          onClick={props.onResume}
        >
          {gt("Continue", { $context: "continue a reply that was cut off" })}
        </Button>
      ) : null}
    </span>
  );
}

/**
 * True while the composer's autoswitch line covers the usage-limit state, so the older usage-limit
 * banner stays out of the way: one state, one message.
 */
export function useAutoswitchCoversLimit(props: AutoswitchScope & { readonly canResume: boolean }) {
  const scope = useAutoswitchScope(props);
  return (
    scope !== null &&
    composerAutoswitchLine({
      state: threadFallbackState(scope.shell),
      order: scope.order,
      providers: scope.providers,
      canResume: props.canResume,
    }) !== null
  );
}

/**
 * The model picker's "For this session" row: switch when the plan runs out, or stay on it.
 * Choosing what the account already does saves no override.
 */
export function ComposerSessionAutoswitchRow(
  props: AutoswitchScope & { readonly activeInstanceId: ProviderInstanceId },
) {
  const gt = useGT();
  const scope = useAutoswitchScope(props);
  const updateMetadata = useOrchestrationCommand(threadEnvironment.updateMetadata, {
    reportFailure: false,
  });
  if (scope === null || props.threadRef === null || scope.shell === null) return null;
  const connectedOrder = defaultConnectedOrder(scope.providers);
  // With one connected plan there is nothing to switch to.
  if (connectedOrder.length < 2) return null;
  const active = scope.providers.find((provider) => provider.instanceId === props.activeInstanceId);
  const switches = sessionSwitches(scope.threadOrder, scope.accountOrder);
  const threadId = scope.shell.id;
  const choose = async (next: boolean) => {
    if (next === switches) return;
    const result = await updateMetadata({
      environmentId: props.environmentId,
      input: {
        threadId,
        ...threadFallbackOrderInput(sessionOverrideFor(next, scope.accountOrder, connectedOrder)),
      },
    });
    if (result._tag === "Failure") {
      toastManager.add({
        type: "error",
        title: gt("Session setting not saved"),
        description: thrownErrorMessage(squashAtomCommandFailure(result), m),
      });
    }
  };
  return (
    <div
      data-composer-session-autoswitch
      className="flex flex-wrap items-center gap-2 border-t border-border/70 bg-muted/40 px-3 py-2"
    >
      <span className="text-xs text-muted-foreground">{gt("For this session")}</span>
      <div
        role="radiogroup"
        aria-label={gt("When this plan runs out")}
        className="ms-auto flex rounded-lg bg-input/40 p-0.5"
      >
        {[true, false].map((value) => (
          <button
            key={String(value)}
            type="button"
            role="radio"
            aria-checked={switches === value}
            data-checked={switches === value || undefined}
            className={FOOTER_SEGMENT}
            onClick={() => void choose(value)}
          >
            {value
              ? gt("Switch when out")
              : active
                ? gt("Stay on {provider}", { provider: active.name })
                : gt("Stay on this plan")}
          </button>
        ))}
      </div>
    </div>
  );
}
