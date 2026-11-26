// @effect-diagnostics nodeBuiltinImport:off -- Exercise the loopback transport.
// @effect-diagnostics globalFetchInEffect:off -- Send real HTTP traffic without a platform client layer.
import * as NodeHttp from "node:http";
import { expect, it } from "@effect/vitest";
import { CommandId, EnvironmentId, ThreadId } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as ThreadMcpServers from "./ThreadMcpServers.ts";
import type { McpInvocationScope } from "./McpInvocationContext.ts";

it.live("rotates the transport credential while preserving the provider registration", () =>
  Effect.gen(function* () {
    const requests: Array<string | undefined> = [];
    const upstream = yield* Effect.acquireRelease(
      Effect.promise(
        () =>
          new Promise<NodeHttp.Server>((resolve) => {
            const server = NodeHttp.createServer((request, response) => {
              requests.push(request.headers.authorization);
              if (request.url === "/redirect") {
                response.writeHead(307, { location: "/unexpected" }).end();
              } else if (request.url === "/slow") {
                request.resume();
              } else {
                response.writeHead(200, { "content-type": "text/event-stream" });
                response.write("event: message\n");
                response.end('data: {"ok":true}\n\n');
              }
            });
            server.listen(0, "127.0.0.1", () => resolve(server));
          }),
      ),
      (server) =>
        Effect.sync(() => {
          server.close();
          server.closeAllConnections();
        }),
    );
    const address = upstream.address();
    if (address === null || typeof address === "string") throw new Error("Missing fixture port");
    const origin = new URL(`http://127.0.0.1:${address.port}`);
    const threadId = ThreadId.make("relay-thread");
    const siblingId = ThreadId.make("sibling");
    const scope = (bearer: string): McpInvocationScope => ({
      environmentId: EnvironmentId.make("test"),
      capabilities: new Set(["orchestration"]),
      issuedAt: 0,
      requestNamespace: "client:relay",
      client: { sessionId: "relay", label: "Fixture relay", access: "full-access" },
      thread: undefined,
      threadMcpAuthorization: ThreadMcpServers.authorizationReferences(
        `{"relay":"Bearer ${bearer}"}`,
      )!,
    });
    const attach = {
      threadId,
      commandId: CommandId.make("fixture-launch"),
      scope: scope("synthetic-first"),
      servers: [{ name: "fixture", url: new URL("/mcp", origin).href, headersRef: "relay" }],
    };
    yield* Effect.gen(function* () {
      const relay = yield* ThreadMcpServers.ThreadMcpServers;
      const unauthorized = yield* relay
        .around({ ...attach, threadId: siblingId }, Effect.void)
        .pipe(Effect.flip);
      expect(unauthorized.code).toBe("invalid_request");
      const first = yield* relay.around({ ...attach, launch: true }, relay.read(threadId));
      expect(first).toEqual([{ name: "fixture", url: expect.any(String), toolTimeoutMs: 180_000 }]);
      expect(yield* relay.read(siblingId)).toEqual([]);

      const url = first[0]!.url;
      const post = (url: string) =>
        Effect.promise(() => fetch(url, { method: "POST", body: "{}" }));
      const response = yield* post(url);
      expect(yield* Effect.promise(() => response.text())).toBe(
        'event: message\ndata: {"ok":true}\n\n',
      );

      const rotated = {
        ...attach,
        commandId: CommandId.make("fixture-send"),
        scope: scope("synthetic-second"),
      };
      yield* relay.around(rotated, Effect.void);
      expect(yield* relay.read(threadId)).toEqual(first);
      yield* relay.around({ ...attach, launch: true }, Effect.void);
      expect((yield* post(url)).status).toBe(200);
      expect(requests).toEqual(["Bearer synthetic-first", "Bearer synthetic-second"]);

      const update = (path: string, toolTimeoutMs?: number) =>
        relay.around(
          {
            ...rotated,
            commandId: CommandId.make(path),
            servers: [
              {
                ...attach.servers[0]!,
                url: new URL(path, origin).href,
                ...(toolTimeoutMs === undefined ? {} : { toolTimeoutMs }),
              },
            ],
          },
          relay.read(threadId),
        );
      const redirect = yield* update("/redirect");
      expect((yield* post(redirect[0]!.url)).status).toBe(502);
      expect(requests).toHaveLength(3);
      expect((yield* post(url)).status).toBe(404);

      const slow = yield* update("/slow", 1000);
      expect((yield* post(slow[0]!.url)).status).toBe(502);
    }).pipe(Effect.provide(ThreadMcpServers.layer({ origin, clientSessionId: "relay" })));
  }).pipe(Effect.scoped),
);
