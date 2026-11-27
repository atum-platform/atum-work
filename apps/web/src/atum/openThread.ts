import { useSyncExternalStore } from "react";

/**
 * The open thread as the Atum host's title bar names it (layout zone B: thread · repo · branch). It rides the
 * sidebar report (`window.atumWork.reportSidebar`) the host already reads; no other channel.
 */
export interface AtumOpenThread {
  readonly title: string;
  /** The thread's project, as the sidebar names it. Absent for a thread without one. */
  readonly repo?: string;
  /** The checkout's branch. Absent when the thread has none yet. */
  readonly branch?: string;
}

let current: AtumOpenThread | null = null;
const listeners = new Set<() => void>();

function publish(next: AtumOpenThread | null) {
  current = next;
  for (const listener of listeners) listener();
}

/** Trims to what the title bar shows; an empty title means nothing to name. */
export function atumOpenThreadFrom(input: {
  title: string | null | undefined;
  repo: string | null | undefined;
  branch: string | null | undefined;
}): AtumOpenThread | null {
  const title = input.title?.trim() ?? "";
  if (title.length === 0) return null;
  const repo = input.repo?.trim() ?? "";
  const branch = input.branch?.trim() ?? "";
  return {
    title,
    ...(repo.length > 0 ? { repo } : {}),
    ...(branch.length > 0 ? { branch } : {}),
  };
}

/** The chat view names its thread; the returned function withdraws it (unmount, another thread). */
export function offerAtumOpenThread(thread: AtumOpenThread | null): () => void {
  publish(thread);
  return () => {
    // Only the offer still showing is withdrawn: a stale cleanup never clears a newer thread.
    if (current === thread && thread !== null) publish(null);
  };
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export function readAtumOpenThread(): AtumOpenThread | null {
  return current;
}

export function useAtumOpenThread(): AtumOpenThread | null {
  return useSyncExternalStore(subscribe, readAtumOpenThread);
}
