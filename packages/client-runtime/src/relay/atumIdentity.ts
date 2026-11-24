/** Atum account assertions feed the native ManagedRelay `clerkToken` input unchanged. */
export interface AtumConnectIdentitySource {
  readonly ownerId: () => string | null;
  readonly getPlatformBearer: () => Promise<string>;
}

export function createAtumConnectIdentity(
  platformOrigin: string,
  source: AtumConnectIdentitySource,
  request: typeof fetch = fetch,
) {
  const origin = new URL(platformOrigin);
  if (
    origin.protocol !== "https:" ||
    origin.username ||
    origin.password ||
    origin.search ||
    origin.hash ||
    origin.pathname !== "/"
  ) {
    throw new Error("Atum platform must be an HTTPS origin");
  }
  return {
    async getAssertion(): Promise<string> {
      const owner = source.ownerId();
      if (!owner) throw new Error("Atum sign-in required");
      const bearer = await source.getPlatformBearer();
      if (source.ownerId() !== owner) throw new Error("Atum account changed");
      const response = await request(new URL("/api/work/connect/assertion", origin), {
        method: "POST",
        headers: { authorization: `Bearer ${bearer}` },
        redirect: "error",
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Atum assertion unavailable (${response.status})`);
      const body: unknown = await response.json();
      if (source.ownerId() !== owner) throw new Error("Atum account changed");
      if (
        typeof body !== "object" ||
        body === null ||
        !("assertion" in body) ||
        typeof body.assertion !== "string" ||
        !body.assertion
      ) {
        throw new Error("Invalid Atum assertion response");
      }
      return body.assertion;
    },
  };
}

/** BridgeConfig.mcp_url uses the environment origin, never the relay API origin. */
export function managedEnvironmentMcpUrl(httpBaseUrl: string): string {
  const url = new URL(httpBaseUrl);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  ) {
    throw new Error("Expected a managed HTTPS environment origin");
  }
  return new URL("/mcp", url).href;
}
