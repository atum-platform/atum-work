import { useNavigate } from "@tanstack/react-router";
import { scopeThreadRef, scopedThreadKey } from "@t3tools/client-runtime/environment";
import {
  AuthFilesystemReadScope,
  AuthFilesystemWriteScope,
  CommandId,
  type ModelSelection,
  type ProjectId,
  type RuntimeMode,
  type ScopedThreadRef,
  type WorkDocumentFormat,
} from "@t3tools/contracts";
import { useGT } from "gt-react";
import { useRef, useState } from "react";

import { finalizePromotedDraftThreadByRef } from "../composerDraftStore";
import { toastManager } from "../components/ui/toast";
import { useStableCallback } from "../hooks/useStableCallback";
import { randomUUID } from "../lib/utils";
import { useRightPanelStore } from "../rightPanelStore";
import { waitForThreadShell } from "../state/entities";
import { useEnvironmentScope } from "../state/session";
import { threadEnvironment } from "../state/threads";
import { useAtomCommand } from "../state/use-atom-command";
import { buildThreadRouteParams } from "../threadRoutes";
import { DEFAULT_INTERACTION_MODE } from "../types";

export function useWorkStarter(input: {
  readonly shown: boolean;
  readonly canOperate: boolean;
  readonly thread: ScopedThreadRef;
  readonly projectId: ProjectId | undefined;
  readonly runtimeMode: RuntimeMode;
  readonly readModel: () => ModelSelection | undefined;
  readonly isCurrentThread: () => boolean;
}) {
  const gt = useGT();
  const navigate = useNavigate();
  const launch = useAtomCommand(threadEnvironment.launch, { reportFailure: false });
  const { environmentId, threadId } = input.thread;
  const canRead = useEnvironmentScope(environmentId, AuthFilesystemReadScope);
  const canWrite = useEnvironmentScope(environmentId, AuthFilesystemWriteScope);
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const launchId = useRef<{ key: string; commandId: CommandId } | null>(null);
  const disabled = !input.canOperate || !canRead || !canWrite || pending;
  const isStarting = useStableCallback(() => inFlight.current);

  const choose = useStableCallback(async (format: WorkDocumentFormat) => {
    if (!input.shown || disabled || inFlight.current || !input.projectId) return;
    const modelSelection = input.readModel();
    if (!modelSelection) return;
    const key = JSON.stringify([scopedThreadKey(input.thread), format]);
    if (launchId.current?.key !== key) {
      launchId.current = { key, commandId: CommandId.make(randomUUID()) };
    }
    inFlight.current = true;
    setPending(true);
    try {
      const result = await launch({
        environmentId,
        input: {
          commandId: launchId.current.commandId,
          threadId,
          projectId: input.projectId,
          title: gt("Untitled"),
          modelSelection,
          runtimeMode: input.runtimeMode,
          interactionMode: DEFAULT_INTERACTION_MODE,
          workspaceStrategy: { type: "root" },
          workFormat: format,
        },
      });
      if (result._tag === "Failure" || !result.value.workStarter) {
        if (input.isCurrentThread()) {
          toastManager.add({ type: "error", title: gt("Could not open a new file. Try again.") });
        }
        return;
      }
      const thread = scopeThreadRef(environmentId, result.value.threadId);
      if (!(await waitForThreadShell(thread))) {
        if (input.isCurrentThread()) {
          toastManager.add({ type: "error", title: gt("Could not open a new file. Try again.") });
        }
        return;
      }
      finalizePromotedDraftThreadByRef(thread);
      if (!input.isCurrentThread()) return;
      useRightPanelStore.getState().openFile(thread, result.value.workStarter.relativePath);
      await navigate({
        to: "/$environmentId/$threadId",
        params: buildThreadRouteParams(thread),
        replace: true,
      });
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  });

  return { pending, disabled, choose, isStarting };
}
