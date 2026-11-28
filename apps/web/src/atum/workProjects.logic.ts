/**
 * Work mode, Cowork-style (owner 2026-11-28): sessions grouped by project, a time-of-day greeting.
 * Pure pieces, so the rules are tested without a renderer.
 */

/** Work mode groups the list by project: T3's own folder sidebar, on for Work whatever the Labs toggle says. */
export function workProjectFoldersOn(
  labsFolders: boolean,
  isWorkBuild: boolean,
  mode: "work" | "code",
): boolean {
  return labsFolders || (isWorkBuild && mode === "work");
}

type WorkGreeting = "morning" | "afternoon" | "evening";

/** The greeting over Work's home, by the reader's local hour (0–23). */
export function workGreeting(hour: number): WorkGreeting {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  return "evening";
}
