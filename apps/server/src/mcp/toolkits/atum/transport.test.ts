// @effect-diagnostics globalFetch:off - preserve the real MCP fetch path while stubbing the connector.
import { NodeHttpServer } from "@effect/platform-node";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { expect, it } from "@effect/vitest";
import { EnvironmentId, ProviderInstanceId, ThreadId } from "@t3tools/contracts";
import * as McpProviderSessions from "@t3tools/provider-core/server/McpProviderSessions";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import { HttpBody, HttpClient, HttpRouter, HttpServer } from "effect/http";
import { vi } from "vite-plus/test";
import { layer as admissionRoutes } from "./admission.ts";
import * as ServerEnvironment from "../../../environment/ServerEnvironment.ts";
import * as ThreadManagement from "../../../orchestration-v2/ThreadManagementService.ts";
import * as ServerSettings from "../../../serverSettings.ts";
import * as McpHttpServer from "../../McpHttpServer.ts";
import * as McpSessionRegistry from "../../McpSessionRegistry.ts";
import { liveThreadShell } from "../../McpToolAccess.testkit.ts";

vi.mock("./config.ts", () => ({
  configured: () => true,
  endpoint: "http://127.0.0.1:43123/ask",
  token: "fixture",
}));

const environmentId = EnvironmentId.make("work-connector-fixture");
const threadId = ThreadId.make("thread:work-connector");
const requestId = "6465392c-2c68-4b3b-ac27-9fdfdd9ddc82";
const layerFixture = Layer.mergeAll(McpSessionRegistry.layer, McpProviderSessions.layer).pipe(
  Layer.provide(
    Layer.mock(ServerEnvironment.ServerEnvironment)({
      getEnvironmentId: Effect.succeed(environmentId),
    }),
  ),
  Layer.provide(NodeCrypto.layer),
  Layer.provideMerge(NodeHttpServer.layerTest),
);

it.live(
  "discovers and calls Work questions through native thread MCP, including after rotation",
  () =>
    Effect.scoped(
      Effect.gen(function* () {
        const registry = yield* McpSessionRegistry.McpSessionRegistry;
        const sessions = yield* McpProviderSessions.McpProviderSessions;
        const baseShell = liveThreadShell(threadId);
        let shell = baseShell;
        const received: Array<unknown> = [];
        let revokeInFlight: (() => Promise<void>) | undefined;
        let provenance = "non_google";
        let admissionOrigin: string | undefined;
        const nativeFetch = globalThis.fetch;
        const connectorFetch = vi.fn<typeof fetch>(async (url, init) => {
          if (/^http:\/\/127\.0\.0\.1:\d+\/mcp$/.test(String(url))) {
            return nativeFetch(url, init);
          }
          expect(String(url)).toBe("http://127.0.0.1:43123/ask");
          expect(new Headers(init?.headers).get("authorization")).toBe("Bearer fixture");
          const request = JSON.parse(String(init?.body));
          received.push(request);
          const { threadId, providerSessionId, providerInstanceId } = request.caller;
          const binding = Buffer.from(
            JSON.stringify([threadId, providerSessionId, providerInstanceId]),
          ).toString("base64url");
          const check = (caller = binding) =>
            nativeFetch(`${admissionOrigin}/atum-work/connector/prepare`, {
              method: "POST",
              headers: {
                authorization: "Bearer fixture",
                "x-atum-work-admission": request.admission,
                "x-atum-work-caller": caller,
              },
            });
          expect((await check("wrong")).status).toBe(409);
          expect((await check()).status).toBe(204);
          await revokeInFlight?.();
          if ((await check()).status !== 204) {
            return Response.json({ state: "unavailable", request_id: requestId });
          }
          return Response.json({
            state: "answered",
            request_id: requestId,
            answer: "fixture answer",
            provenance,
          });
        });
        yield* Effect.acquireRelease(
          Effect.sync(() => {
            vi.stubGlobal("fetch", connectorFetch);
          }),
          () =>
            Effect.promise(async () => {
              vi.unstubAllGlobals();
            }),
        );

        const outsideToken = "outside.fixture";
        const server = McpHttpServer.layerMcpTransport(McpHttpServer.layerAtumToolkit).pipe(
          Layer.provide(ServerSettings.layerTest({ linkedEnvironmentsEnabled: true })),
          Layer.provide(
            Layer.mock(ThreadManagement.ThreadManagementService)({
              getThreadShell: () => Effect.sync(() => shell),
            }),
          ),
          Layer.provide(
            Layer.succeed(McpHttpServer.McpClientAuthenticator)({
              authenticate: (request) =>
                Effect.succeed(
                  request.headers.authorization === `Bearer ${outsideToken}`
                    ? {
                        environmentId,
                        requestNamespace: "peer-link",
                        client: {
                          sessionId: "peer-link",
                          label: "peer",
                          access: "full-access",
                          linked: true,
                        },
                        thread: undefined,
                        capabilities: new Set(["orchestration"]),
                        issuedAt: 1,
                      }
                    : undefined,
                ),
            }),
          ),
        );
        yield* HttpRouter.serve(Layer.merge(server, admissionRoutes), {
          disableListenLog: true,
          disableLogger: true,
        }).pipe(Layer.build);
        const listener = yield* HttpServer.HttpServer;
        if (listener.address._tag === "UnixPathAddress")
          throw new Error("Expected loopback fixture");
        const host = listener.address._tag === "InetAddressV6" ? "[::1]" : "127.0.0.1";
        admissionOrigin = `http://${host}:${listener.address.port}`;

        const http = yield* HttpClient.HttpClient;
        const open = Effect.fnUntraced(function* (authorization: string) {
          const post = (method: string, params: object, session?: string) =>
            http.post("/mcp", {
              headers: {
                accept: "application/json, text/event-stream",
                authorization,
                ...(session
                  ? { "mcp-session-id": session, "mcp-protocol-version": "2025-06-18" }
                  : {}),
              },
              body: HttpBody.text(
                JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
                "application/json",
              ),
            });
          const init = yield* post("initialize", {
            protocolVersion: "2025-06-18",
            capabilities: {},
            clientInfo: { name: "connector-fixture", version: "1.0" },
          });
          expect(init.status).toBe(200);
          const session = init.headers["mcp-session-id"];
          expect(session).toBeTruthy();
          return (method: string, params: object) => post(method, params, session);
        });

        const args = { agent: "owned", request_id: requestId };
        const call = { name: "ask_my_agent", arguments: args };
        const outside = yield* open(`Bearer ${outsideToken}`);
        expect(yield* (yield* outside("tools/list", {})).json).toMatchObject({
          result: { tools: [] },
        });
        const refused = yield* (yield* outside("tools/call", call)).text;
        expect(refused).not.toContain("fixture answer");
        expect(received).toHaveLength(0);

        for (const name of ["codex", "claudeAgent", "antigravity", "atum-managed"]) {
          const providerInstanceId = ProviderInstanceId.make(name);
          shell = {
            ...baseShell,
            providerInstanceId,
            modelSelection: { instanceId: providerInstanceId, model: "fixture" },
          };
          let previous: Effect.Success<ReturnType<typeof open>> | undefined;
          for (const resumed of [false, true]) {
            const { config } = yield* registry.issue({ threadId, providerInstanceId });
            yield* sessions.set(config);
            if (resumed) expect((yield* previous!("tools/list", {})).status).toBe(401);
            const rpc = yield* open(config.authorizationHeader);
            expect(yield* (yield* rpc("tools/list", {})).json).toMatchObject({
              result: { tools: [{ name: "ask_my_agent" }] },
            });
            expect(yield* (yield* rpc("tools/call", call)).json).toMatchObject({
              result: { structuredContent: { state: "answered", answer: "fixture answer" } },
            });
            expect(received.at(-1)).toEqual({
              caller: { threadId, providerSessionId: config.providerSessionId, providerInstanceId },
              question: args,
              admission: expect.any(String),
            });
            if (resumed) {
              for (const classification of ["google", "unknown"]) {
                provenance = classification;
                expect(yield* (yield* rpc("tools/call", call)).json).toMatchObject({
                  result: {
                    structuredContent: { state: "answered", answer: "fixture answer", provenance },
                  },
                });
              }
              provenance = "non_google";
            }
            previous = rpc;
            if (!resumed) yield* registry.revokeProviderSession(config.providerSessionId);
          }
        }

        const current = (yield* sessions.read(threadId))!;
        const rpc = yield* open(current.authorizationHeader);
        const started = Promise.withResolvers<void>();
        const resumed = Promise.withResolvers<void>();
        revokeInFlight = () => {
          started.resolve();
          return resumed.promise;
        };
        const pending = yield* rpc("tools/call", call).pipe(Effect.forkScoped);
        yield* Effect.promise(() => started.promise);
        yield* registry.revokeProviderSession(current.providerSessionId);
        resumed.resolve();
        expect(yield* (yield* Fiber.join(pending)).json).toMatchObject({
          result: { structuredContent: { state: "unavailable", request_id: requestId } },
        });
      }),
    ).pipe(Effect.provide(layerFixture)),
);
