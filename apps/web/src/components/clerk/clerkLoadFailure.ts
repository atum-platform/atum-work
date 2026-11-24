import { useClerk } from "@clerk/react";

export function useClerkLoadFailed() {
  if (import.meta.env.VITE_ATUM_WORK_BUILD === "1") return false;
  return useClerk().status === "error";
}

export function retryClerkLoad() {
  // Clerk caches its failed script load for the life of the page and never
  // retries, so a reload is the only recovery.
  window.location.reload();
}
