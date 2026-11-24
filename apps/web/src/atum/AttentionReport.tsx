import { useAtomValue } from "@effect/atom-react";
import { scopeThreadRef, scopedThreadKey } from "@t3tools/client-runtime/environment";
import { isListedThreadLineage } from "@t3tools/contracts";
import { useEffect } from "react";

import { resolveBackgroundThreadRequest } from "../components/backgroundThreadAnnouncement";
import { hasUnseenCompletion, resolveThreadLastVisitedAt } from "../components/Sidebar.logic";
import { liveShellEnvironmentIdsAtom } from "../state/shell";
import { environmentThreadShells } from "../state/threads";
import { useUiStateStore } from "../uiStateStore";

/**
 * Tells the Atum host how many threads ask for the person (an approval or an answer) and how many
 * finished unseen, for Work's rail badge. Counts only; no titles or ids leave the view.
 */
export function AtumAttentionReport() {
  const threads = useAtomValue(environmentThreadShells.quietThreadShellsAtom);
  const liveEnvironmentIds = useAtomValue(liveShellEnvironmentIdsAtom);
  const localVisits = useUiStateStore((state) => state.threadLastVisitedAtById);

  let waiting = 0;
  let finished = 0;
  for (const thread of threads) {
    if (thread.archivedAt !== null || !isListedThreadLineage(thread.lineage)) continue;
    if (!liveEnvironmentIds.has(thread.environmentId)) continue;
    if (resolveBackgroundThreadRequest(thread).request !== null) {
      waiting += 1;
      continue;
    }
    const key = scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id));
    const lastVisitedAt = resolveThreadLastVisitedAt(thread.lastVisitedAt, localVisits[key]);
    if (hasUnseenCompletion({ ...thread, lastVisitedAt })) finished += 1;
  }

  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- reports the counts to the native host
  useEffect(() => {
    void window.atumWork?.reportAttention?.({ waiting, finished });
  }, [waiting, finished]);
  return null;
}
