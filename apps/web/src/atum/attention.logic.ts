import { scopeThreadRef, scopedThreadKey } from "@t3tools/client-runtime/environment";
import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import { isListedThreadLineage } from "@t3tools/contracts";

import { resolveBackgroundThreadRequest } from "../components/backgroundThreadAnnouncement";
import { hasUnseenCompletion, resolveThreadLastVisitedAt } from "../components/Sidebar.logic";

export interface WorkAttentionCounts {
  readonly waiting: number;
  readonly finished: number;
}

/**
 * What Work's rail badge counts, from the same thread list the sidebar draws (hidden threads are
 * already gone from it). A thread that asks for the person counts wherever it sits. A finished,
 * unseen thread counts only outside the Settled shelf: settling puts it away, and the shelf is
 * folded, so the person can't see the unread mark that the badge would point at.
 */
export function countWorkAttention(
  threads: ReadonlyArray<EnvironmentThreadShell>,
  liveEnvironmentIds: ReadonlySet<string>,
  localVisits: Readonly<Record<string, string>>,
): WorkAttentionCounts {
  let waiting = 0;
  let finished = 0;
  for (const thread of threads) {
    if (thread.archivedAt !== null || !isListedThreadLineage(thread.lineage)) continue;
    if (!liveEnvironmentIds.has(thread.environmentId)) continue;
    if (resolveBackgroundThreadRequest(thread).request !== null) {
      waiting += 1;
      continue;
    }
    if (thread.settledOverride === "settled") continue;
    const key = scopedThreadKey(scopeThreadRef(thread.environmentId, thread.id));
    const lastVisitedAt = resolveThreadLastVisitedAt(thread.lastVisitedAt, localVisits[key]);
    if (hasUnseenCompletion({ ...thread, lastVisitedAt })) finished += 1;
  }
  return { waiting, finished };
}
