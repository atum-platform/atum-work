// @effect-diagnostics nodeBuiltinImport:off -- Exercise the loopback transport.
// @effect-diagnostics globalFetchInEffect:off -- Send real HTTP traffic without a platform client layer.
import * as NodeHttp from "node:http";
import { expect, it } from "@effect/vitest";
import { CommandId, EnvironmentId, ProviderInstanceId, ThreadId } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import { vi } from "vite-plus/test";
import * as ThreadMcpServers from "./ThreadMcpServers.ts";
import type { McpInvocationScope } from "./McpInvocationContext.ts";

it("requires a valid origin list and allows IPv4 loopback HTTP for fixtures", () => {
  expect(ThreadMcpServers.configure("https://relay.example, http://127.0.0.1:9000")).toBeDefined();
  for (const config of [
    undefined,
    "",
    "https://relay.example/path",
    "https://relay.example,https://*.atumplatform.com",
    "http://relay.example",
  ]) {
    expect(ThreadMcpServers.configure(config)).toBeUndefined();
  }
});

it.effect("binds visible learning to the enrolled owner, assistant and OAuth session", () =>
  Effect.gen(function* () {
    const relay = yield* ThreadMcpServers.ThreadMcpServers;
    const grant = {
      clientId: "native",
      actor: "owner",
      audience: "owner_dm" as const,
      enabled: true,
      expiresAt: 999_999_999,
      binding: {
        owner: "owner",
        agent: "selected",
        generation: "g1",
        mac: "mac",
        consent_revision: 1,
      },
    };
    const scope = {
      environmentId: EnvironmentId.make("fixture"),
      capabilities: new Set(["orchestration"] as const),
      issuedAt: 0,
      requestNamespace: "fixture",
      client: { sessionId: "relay", label: "Relay", access: "full-access", nativeConsent: grant },
      thread: undefined,
      threadMcpAuthorization: ThreadMcpServers.authorizationReferences(
        '{"relay":"Bearer synthetic"}',
      )!,
    } satisfies McpInvocationScope;
    const threadId = ThreadId.make("visible-work");
    const launch = {
      scope,
      threadId,
      commandId: CommandId.make("launch"),
      launch: true,
      assistantLearning: true,
      servers: [
        {
          name: "atum-agent-tools",
          url: "https://relay.example/a/selected/mcp",
          headersRef: "relay",
        },
      ],
    } as const;
    const denied = yield* relay
      .around({ ...launch, scope: { ...scope, client: undefined } }, Effect.void)
      .pipe(Effect.flip);
    expect(denied.code).toBe("thread_mcp_attachment_denied");

    const first = yield* relay.around(launch, relay.read(threadId));
    expect(yield* relay.requiresAssistantRelay(threadId)).toBe(true);
    expect(yield* relay.requiresAssistantRelay(ThreadId.make("work-learning-cold-thread"))).toBe(
      true,
    );
    const send = { scope, threadId, commandId: CommandId.make("send"), servers: launch.servers };
    const withoutAttachment = yield* relay
      .around({ ...send, servers: undefined }, Effect.void)
      .pipe(Effect.flip);
    expect(withoutAttachment.code).toBe("thread_mcp_attachment_denied");
    for (const client of [
      { ...scope.client, sessionId: "other-relay" },
      {
        ...scope.client,
        nativeConsent: { ...grant, binding: { ...grant.binding, agent: "other" } },
      },
      {
        ...scope.client,
        nativeConsent: { ...grant, binding: { ...grant.binding, owner: "other" } },
      },
    ]) {
      const error = yield* relay
        .around({ ...send, scope: { ...scope, client } }, Effect.void)
        .pipe(Effect.flip);
      expect(error.code).toBe("thread_mcp_attachment_denied");
    }
    const wrongEndpoint = yield* relay
      .around(
        {
          ...send,
          servers: [{ ...launch.servers[0], url: "https://relay.example/a/other/mcp" }],
        },
        Effect.void,
      )
      .pipe(Effect.flip);
    expect(wrongEndpoint.code).toBe("invalid_request");
    expect(yield* relay.around(send, relay.read(threadId))).toEqual(first);
  }).pipe(Effect.provide(ThreadMcpServers.layer(new Set(["https://relay.example"])))),
);

it.live(
  "isolates OAuth owners and rotates credentials without changing provider registrations",
  () =>
    Effect.gen(function* () {
      const requests: Array<string | undefined> = [];
      const releaseLongCall = Promise.withResolvers<void>();
      const longCallStarted = Promise.withResolvers<void>();
      const timedOut = Promise.withResolvers<void>();
      const cancelled = Promise.withResolvers<void>();
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
                  response.once("close", timedOut.resolve);
                } else if (request.url === "/long") {
                  request.resume();
                  longCallStarted.resolve();
                  void releaseLongCall.promise.then(() => response.end("long call complete"));
                } else if (request.url === "/cancel") {
                  request.resume();
                  response.writeHead(200, { "content-type": "text/event-stream" });
                  response.write("event: message\n");
                  response.once("close", cancelled.resolve);
                } else if (
                  request.url === "/mcp" &&
                  request.headers["mcp-name"] !== "fixture_tool"
                ) {
                  response.writeHead(400).end();
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
      const scope = (bearer: string, sessionId = "relay"): McpInvocationScope => ({
        environmentId: EnvironmentId.make("test"),
        capabilities: new Set(["orchestration"]),
        issuedAt: 0,
        requestNamespace: `client:${sessionId}`,
        client: { sessionId, label: "Fixture relay", access: "full-access" },
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
        const ownerThread = yield* relay
          .around({ ...attach, threadId: siblingId }, Effect.void)
          .pipe(Effect.flip);
        expect(ownerThread.code).toBe("thread_mcp_attachment_denied");
        for (const caller of [
          { ...attach.scope, client: undefined },
          {
            ...attach.scope,
            client: undefined,
            thread: {
              threadId,
              providerSessionId: "provider-session",
              providerInstanceId: ProviderInstanceId.make("claude"),
            },
          },
        ]) {
          const denied = yield* relay
            .around({ ...attach, scope: caller, launch: true }, Effect.void)
            .pipe(Effect.flip);
          expect(denied.code).toBe("thread_mcp_attachment_denied");
        }
        const first = yield* relay.around({ ...attach, launch: true }, relay.read(threadId));
        expect(first).toEqual([
          { name: "fixture", url: expect.any(String), toolTimeoutMs: 180_000 },
        ]);
        const second = {
          ...attach,
          threadId: siblingId,
          scope: scope("synthetic-other", "second-relay"),
        };
        const secondRegistration = yield* relay.around(
          { ...second, launch: true, servers: undefined },
          relay.read(siblingId),
        );
        expect(secondRegistration).toEqual([]);
        const ownUpdate = yield* relay.around(
          { ...second, commandId: CommandId.make("second-relay-update") },
          relay.read(siblingId),
        );
        expect(ownUpdate[0]!.url).not.toBe(first[0]!.url);
        const crossClient = yield* relay
          .around({ ...attach, threadId: siblingId }, Effect.void)
          .pipe(Effect.flip);
        expect(crossClient.code).toBe("thread_mcp_attachment_denied");
        expect(yield* relay.read(siblingId)).toEqual(ownUpdate);

        const url = first[0]!.url;
        const post = (url: string) =>
          Effect.promise(() =>
            fetch(url, {
              method: "POST",
              headers: {
                "content-type": "application/json",
                "mcp-method": "tools/call",
                "mcp-name": "fixture_tool",
              },
              body: JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                method: "tools/call",
                params: { name: "fixture_tool" },
              }),
            }),
          );
        const response = yield* post(url);
        expect(response.status).toBe(200);
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
        yield* Effect.promise(() => timedOut.promise);

        const long = yield* update("/long", 7_200_000);
        const timeout = vi.spyOn(AbortSignal, "timeout");
        yield* Effect.addFinalizer(() => Effect.sync(() => void timeout.mockRestore()));
        const call = post(long[0]!.url).pipe(
          Effect.flatMap((res) => Effect.promise(() => res.text())),
        );
        const running = yield* Effect.forkChild(call);
        yield* Effect.promise(() => longCallStarted.promise);
        expect(timeout).toHaveBeenCalledWith(7_200_000);
        releaseLongCall.resolve();
        expect(yield* Fiber.join(running)).toBe("long call complete");

        const cancellable = yield* update("/cancel", 7_200_000);
        const streaming = Promise.withResolvers<number>();
        const providerCall = yield* Effect.forkChild(
          Effect.promise(async (signal) => {
            const response = await fetch(cancellable[0]!.url, {
              method: "POST",
              body: "{}",
              signal,
            });
            streaming.resolve(response.status);
            await response.text();
          }),
        );
        expect(yield* Effect.promise(() => streaming.promise)).toBe(200);
        yield* Fiber.interrupt(providerCall);
        yield* Effect.promise(() => cancelled.promise);
      }).pipe(Effect.provide(ThreadMcpServers.layer(new Set([origin.origin]))));
    }).pipe(Effect.scoped),
);
