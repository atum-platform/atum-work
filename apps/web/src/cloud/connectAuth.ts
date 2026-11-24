import { useAuth as useClerkAuth } from "@clerk/react";
import { useSyncExternalStore } from "react";
import { atumConnectIdentity, assertionOwner } from "../atum/connectIdentity";
import { resolveRelayClerkTokenOptions } from "./publicConfig";

let account: string | null | undefined;
const listeners = new Set<() => void>();
export function setAtumConnectAccount(value: string | null) {
  account = value;
  for (const listener of listeners) listener();
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
function useAtumAuth() {
  const owner = useSyncExternalStore(subscribe, () => account);
  return {
    isLoaded: owner !== undefined,
    isSignedIn: typeof owner === "string",
    userId: owner ?? null,
    getToken: async (_options?: unknown) => {
      const assertion = await atumConnectIdentity.getAssertion();
      if (!owner || assertionOwner(assertion) !== owner) throw new Error("Atum account changed");
      return assertion;
    },
  };
}

// Build identity is constant for the lifetime of the app, including hook selection.
export const useConnectAuth = import.meta.env.VITE_ATUM_WORK_BUILD === "1" ? useAtumAuth : useClerkAuth;
export function connectTokenOptions() {
  return import.meta.env.VITE_ATUM_WORK_BUILD === "1" ? undefined : resolveRelayClerkTokenOptions();
}
