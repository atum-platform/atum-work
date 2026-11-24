import { useEffect, type ReactNode } from "react";
import { activateManagedRelayAuthentication, deactivateManagedRelayAuthentication } from "../cloud/managedAuth";
import { atumConnectIdentity, assertionOwner } from "./connectIdentity";
import { setAtumConnectAccount } from "../cloud/connectAuth";

export default function AtumConnectAuthShell({ children }: { readonly children: ReactNode; readonly publishableKey: string }) {
  // The desktop destroys the owner view on sign-out/account switch; late reads must not reactivate it.
  useEffect(() => {
    let active = true;
    void atumConnectIdentity.getAssertion().then(assertion => {
      if (!active) return;
      const owner = assertionOwner(assertion);
      activateManagedRelayAuthentication(owner, async () => {
        const next = await atumConnectIdentity.getAssertion();
        if (!active || assertionOwner(next) !== owner) throw new Error("Atum account changed");
        return next;
      });
      setAtumConnectAccount(owner);
    }).catch(() => {
      if (active) setAtumConnectAccount(null);
    });
    return () => {
      active = false;
      setAtumConnectAccount(null);
      deactivateManagedRelayAuthentication();
    };
  }, []);
  return children;
}
