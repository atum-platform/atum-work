import { createAtumConnectIdentity } from "@t3tools/client-runtime/relay/atum-identity";

export const atumConnectIdentity = createAtumConnectIdentity({
  getAssertion: async () => {
    const bridge = window.atumWork;
    if (!bridge?.getConnectAssertion) throw new Error("Atum sign-in required");
    return bridge.getConnectAssertion();
  },
});

export function assertionOwner(assertion: string): string {
  const payload = assertion.split(".")[1];
  if (!payload) throw new Error("Invalid Atum assertion");
  const claims: unknown = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  if (!claims || typeof claims !== "object" || !("sub" in claims) || typeof claims.sub !== "string" || !claims.sub) {
    throw new Error("Invalid Atum owner");
  }
  return claims.sub;
}
