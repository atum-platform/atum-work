import { ClerkProvider, getClerkInstance } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import type { ReactNode } from "react";

import { cloudAccountService, deactivateCloudRelayAccount } from "./cloudAccountService";
import { AtumTransportProofAuth } from "./AtumTransportProofAuth";
import { isAtumTransportProof, resolveCloudPublicConfig } from "./publicConfig";

const cloudConfig = resolveCloudPublicConfig();
// Build-time constant: null when this build has no cloud config.
const publishableKey =
  !isAtumTransportProof() && cloudConfig.relay.url ? cloudConfig.clerk.publishableKey : null;

if (publishableKey) {
  // The same native singleton ClerkProvider renders with, so the service
  // observes it for the app's lifetime without a React subscription.
  cloudAccountService.attach(getClerkInstance({ publishableKey }));
} else {
  // Without cloud config no account can ever activate, so drop anything a
  // previous build with cloud enabled left registered.
  deactivateCloudRelayAccount();
}

export function CloudAuthProvider(props: { readonly children: ReactNode }) {
  if (isAtumTransportProof()) {
    return <AtumTransportProofAuth>{props.children}</AtumTransportProofAuth>;
  }
  if (!publishableKey) {
    return props.children;
  }

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      {props.children}
    </ClerkProvider>
  );
}
