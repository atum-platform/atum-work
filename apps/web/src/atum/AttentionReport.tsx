import { useAtomValue } from "@effect/atom-react";
import { useEffect } from "react";

import { liveShellEnvironmentIdsAtom } from "../state/shell";
import { environmentThreadShells } from "../state/threads";
import { useUiStateStore } from "../uiStateStore";
import { countWorkAttention } from "./attention.logic";

/**
 * Tells the Atum host how many threads ask for the person (an approval or an answer) and how many
 * finished unseen, for Work's rail badge. Counts only; no titles or ids leave the view.
 */
export function AtumAttentionReport() {
  const threads = useAtomValue(environmentThreadShells.quietThreadShellsAtom);
  const liveEnvironmentIds = useAtomValue(liveShellEnvironmentIdsAtom);
  const localVisits = useUiStateStore((state) => state.threadLastVisitedAtById);
  const { waiting, finished } = countWorkAttention(threads, liveEnvironmentIds, localVisits);

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- reports the counts to the native host
  useEffect(() => {
    void window.atumWork?.reportAttention?.({ waiting, finished });
  }, [waiting, finished]);
  return null;
}
