import { useEffect } from "react";
import { EnvironmentId, type AtumSurfaceMode, type ProjectId } from "@t3tools/contracts";
import { resolveProjectSettings } from "@t3tools/shared/projectSettings";
import { useStableCallback } from "../hooks/useStableCallback";
import { useEnvironmentSettings } from "../hooks/useSettings";
import { usePrimaryEnvironmentId } from "../state/environments";
import { useAtomCommand } from "../state/use-atom-command";
import { serverEnvironment } from "../state/server";

export const isAtumWorkBuild = import.meta.env.VITE_ATUM_WORK_BUILD === "1";
export interface SurfaceModeSnapshot {
  projectId: string;
  mode: AtumSurfaceMode;
}

declare global {
  interface Window {
    atumSurfaceMode?: {
      getSurfaceMode(): SurfaceModeSnapshot | null;
      setSurfaceMode(projectId: string, mode: AtumSurfaceMode): Promise<void>;
    };
  }
}

export function useAtumSurfaceMode(projectId: ProjectId | null, environmentId?: EnvironmentId) {
  const primary = usePrimaryEnvironmentId();
  const settings = useEnvironmentSettings(
    environmentId ?? primary ?? EnvironmentId.make("atum-no-environment"),
  );
  return isAtumWorkBuild
    ? resolveProjectSettings(settings, projectId).settings.atumSurfaceMode
    : "code";
}

export function useAtumSurfaceModeController(
  projectId: ProjectId | null,
  environmentId: EnvironmentId,
  active: boolean,
) {
  const mode = useAtumSurfaceMode(projectId, environmentId);
  const settings = useEnvironmentSettings(environmentId);
  const persist = useAtomCommand(serverEnvironment.updateSettings);
  const setMode = useStableCallback(async (id: string, value: AtumSurfaceMode) => {
    if (
      !isAtumWorkBuild ||
      !projectId ||
      id !== projectId ||
      (value !== "work" && value !== "code")
    )
      throw new Error("work_project_unavailable");
    const result = await persist({
      environmentId,
      input: {
        patch: {
          projectSettingsOverrides: {
            [projectId]: {
              ...settings.projectSettingsOverrides[projectId],
              atumSurfaceMode: value,
            },
          },
        },
      },
    });
    if (result._tag !== "Success") throw new Error("work_mode_not_saved");
  });
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- Synchronizes the active project with the native host and theme root.
  useEffect(() => {
    if (!isAtumWorkBuild || !active) return;
    document.documentElement.dataset.atumMode = mode;
    const snapshot = projectId ? { projectId, mode } : null;
    const bridge = {
      getSurfaceMode: () => snapshot,
      setSurfaceMode: (id: string, value: AtumSurfaceMode) => setMode(id, value),
    };
    window.atumSurfaceMode = bridge;
    void window.atumWork?.reportSurfaceMode?.(snapshot);
    return () => {
      if (window.atumSurfaceMode === bridge) {
        delete window.atumSurfaceMode;
        void window.atumWork?.reportSurfaceMode?.(null);
      }
    };
  }, [active, mode, projectId, setMode]);
  return {
    mode,
    setMode: (value: AtumSurfaceMode) =>
      projectId ? setMode(projectId, value) : Promise.resolve(),
  };
}
