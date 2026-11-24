import { Atom } from "effect/reactivity";
import { environmentShell } from "../state/shell";
import { useAtomValue } from "@effect/atom-react";
import { useEffect } from "react";
import { primaryServerConfigAtom } from "../state/server";
import { usePrimaryEnvironmentId } from "../state/environments";

import { useEnvironmentPresentation } from "../state/presentation";

export const primaryWorkShellReadyAtom = Atom.make((get) => {
  const config = get(primaryServerConfigAtom);
  return (
    config !== null &&
    get(environmentShell.stateValueAtom(config.environment.environmentId)).status === "live"
  );
});

const reported = new Set<string>();
export function reportWorkStartupPhase(
  phase: "ws-connected" | "providers-ready" | "threads-painted",
) {
  if (import.meta.env.VITE_ATUM_WORK_BUILD !== "1" || reported.has(phase)) return;
  reported.add(phase);
  void window.atumWork?.reportStartupPhase?.(phase).catch(() => undefined);
}

export function AtumStartupReport() {
  const id = usePrimaryEnvironmentId();
  const { presentation } = useEnvironmentPresentation(id);
  const config = useAtomValue(primaryServerConfigAtom);
  const connected = presentation?.connection.phase === "connected";
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- reports connection and the usable provider snapshot to the native host
  useEffect(() => {
    if (connected) reportWorkStartupPhase("ws-connected");
    // Pending provider snapshots are usable; their probes stream updates without holding first paint.
    if (config) reportWorkStartupPhase("providers-ready");
  }, [connected, config]);
  return null;
}
