import { useClerk } from "@clerk/react";

import { isElectron } from "../../env";
import { resolveClerkSignInProps } from "./authRedirect";
import { retryClerkLoad } from "./clerkLoadFailure";

function useClerkT3ConnectAuthPrompt() {
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

export const useT3ConnectAuthPrompt = import.meta.env.VITE_ATUM_WORK_BUILD === "1"
  ? () => ({ openAuthPrompt: () => window.location.reload() })
  : useClerkT3ConnectAuthPrompt;
