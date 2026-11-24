import { useClerk } from "@clerk/react";

import { isElectron } from "../../env";
import { resolveClerkSignInProps } from "./authRedirect";
import { retryClerkLoad } from "./clerkLoadFailure";

export function useT3ConnectAuthPrompt() {
  if (import.meta.env.VITE_ATUM_WORK_BUILD === "1") return { openAuthPrompt: () => window.location.reload() };
  const clerk = useClerk();
  const openAuthPrompt = () => {
    if (clerk.status === "error") {
      retryClerkLoad();
      return;
    }
    clerk.openSignIn(resolveClerkSignInProps(window.location.href, isElectron));
  };
  return { openAuthPrompt };
}
