// @effect-diagnostics nodeBuiltinImport:off - Prove the Desktop loopback connector before exposing account tools.
import * as NodeCrypto from "node:crypto";
import * as NodeHttp from "node:http";
import * as McpProviderSessions from "@t3tools/provider-core/server/McpProviderSessions";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import * as ThreadMcpServers from "./ThreadMcpServers.ts";
import { endpoint, token } from "./toolkits/atum/config.ts";

function proveConnector(
  connector: URL,
  nonce: string,
  expected: Buffer,
  signal: AbortSignal,
): Promise<boolean> {
  const url = new URL("/mcp/health", connector);
  url.searchParams.set("nonce", nonce);
  return new Promise((resolve) => {
    const request = NodeHttp.request(
      url,
      { method: "HEAD", agent: false, signal: AbortSignal.any([signal, AbortSignal.timeout(750)]) },
      (response) => {
        response.resume();
        const header = response.headers["x-atum-work-mcp-proof"];
        const proof = Buffer.from(typeof header === "string" ? header : "", "base64url");
        resolve(
          response.statusCode === 204 &&
            proof.length === expected.length &&
            NodeCrypto.timingSafeEqual(proof, expected),
        );
      },
    );
    request.once("error", () => resolve(false));
    request.end();
  });
}

export const readConnectorMcpServers = Effect.fn("readConnectorMcpServers")(function (
  endpoint: string | undefined,
  token: string | undefined,
) {
  const connector = endpoint === undefined ? null : URL.parse(endpoint);
  if (
    connector === null ||
    !/^http:\/\/127\.0\.0\.1:\d+\/ask$/.test(endpoint ?? "") ||
    token === undefined ||
    !/^[a-zA-Z0-9_-]{43}$/.test(token)
  ) {
    return Effect.succeed([]);
  }

  const mac = (message: string) => NodeCrypto.createHmac("sha256", token).update(message).digest();
  // Stable for one connector lifetime and unavailable to repository configuration at rest.
  const tag = mac("atum-work-mcp-names-v1").toString("hex", 0, 8);
  const authorizationHeader = `Bearer ${mac("atum-work-mcp-bearer-v1").toString("base64url")}`;
  const servers = ["google", "owner-chats"].map((route) => ({
    name: `atum-account-${route}-${tag}`,
    url: new URL(`/mcp/${route}`, connector).href,
    authorizationHeader,
  }));

  // Prove connector ownership without sending a bearer or a query to a recycled port.
  return Effect.promise(async (signal) => {
    const nonce = NodeCrypto.randomUUID();
    const expected = mac(`atum-work-mcp-health-v1:${nonce}`);
    return (await proveConnector(connector, nonce, expected, signal)) ? servers : [];
  });
});

const readAccountServers = readConnectorMcpServers(endpoint, token);
const threadServers = ThreadMcpServers.configure(process.env.T3CODE_THREAD_MCP_ORIGIN);

export const layer =
  threadServers === undefined
    ? McpProviderSessions.layerWithManagedServers(readAccountServers)
    : Layer.unwrap(
        ThreadMcpServers.ThreadMcpServers.pipe(
          Effect.map((relay) =>
            McpProviderSessions.layerWithManagedServers(readAccountServers, relay.read),
          ),
        ),
      ).pipe(Layer.provideMerge(threadServers));
