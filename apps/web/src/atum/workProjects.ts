import { isAtumWorkBuild, useActiveAtumSurfaceMode } from "./surfaceMode";
import { workProjectFoldersOn } from "./workProjects.logic";

/** True while the active chat is in Work mode, where T3's "thread" reads "session". */
export function useWorkLanguage(): boolean {
  const mode = useActiveAtumSurfaceMode();
  return isAtumWorkBuild && mode === "work";
}

/** T3's folder sidebar (Labs "project folders"), always on in Work mode. */
export function useWorkProjectFolders(labsFolders: boolean): boolean {
  return workProjectFoldersOn(labsFolders, isAtumWorkBuild, useActiveAtumSurfaceMode());
}
