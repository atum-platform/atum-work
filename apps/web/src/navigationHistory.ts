import { useSyncExternalStore } from "react";

export type HistoryDirection = "back" | "forward";

function subscribeToNavigationHistory(onChange: () => void): () => void {
  const navigation = window.navigation;
  if (!navigation) return () => {};
  navigation.addEventListener("currententrychange", onChange);
  return () => navigation.removeEventListener("currententrychange", onChange);
}

export function canNavigateHistory(direction: HistoryDirection): boolean {
  return direction === "back"
    ? (window.navigation?.canGoBack ?? false)
    : (window.navigation?.canGoForward ?? false);
}

export function navigateHistory(direction: HistoryDirection) {
  if (direction === "back") window.history.back();
  else window.history.forward();
}

/** The Navigation API is Chromium-only; other browsers report no available history. */
export function useCanNavigateHistory(direction: HistoryDirection): boolean {
  return useSyncExternalStore(subscribeToNavigationHistory, () => canNavigateHistory(direction));
}
