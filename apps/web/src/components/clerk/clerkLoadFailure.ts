import { useClerk } from "@clerk/react";

function useClerkAccountLoadFailed() {
  return useClerk().status === "error";
}

export function retryClerkLoad() {
  // Clerk caches its failed script load for the life of the page and never
  // retries, so a reload is the only recovery.
  window.location.reload();
}

export const useClerkLoadFailed = import.meta.env.VITE_ATUM_WORK_BUILD === "1" ? () => false : useClerkAccountLoadFailed;
