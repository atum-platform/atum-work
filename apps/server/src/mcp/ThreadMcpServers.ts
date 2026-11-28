// @effect-diagnostics nodeBuiltinImport:off -- The credential injector listens on a separate loopback socket.
import * as NodeHttp from "node:http";
import * as NodeHttps from "node:https";
import * as NodeCrypto from "node:crypto";
import {
  type CommandId,
  OrchestratorMcpFailure,
  type OrchestratorMcpThreadServers,
  type ThreadId,
} from "@t3tools/contracts";
import type { ManagedMcpServer } from "@t3tools/provider-core/server/mcpSession";
import * as KeyedLock from "@t3tools/shared/KeyedLock";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import type { McpInvocationScope } from "./McpInvocationContext.ts";
import { sameLearningOwner } from "./toolkits/atum/forwardAdmission.ts";

// Effect redacts this header in HTTP traces by default.
export const AUTHORIZATION_HEADER = "x-api-key";

const attachmentDenied = () =>
  new OrchestratorMcpFailure({
    code: "thread_mcp_attachment_denied",
    message:
      "Thread MCP servers require an enabled relay origin and the OAuth session that launched the thread.",
  });

const invalid = () =>
  new OrchestratorMcpFailure({
    code: "invalid_request",
    message: "Invalid thread MCP server, origin, or authorization reference.",
  });

interface Registration {
  readonly provider: ManagedMcpServer;
  readonly path: string;
  readonly target: URL;
  readonly authorization: Redacted.Redacted<string>;
}

interface ThreadRegistration {
  readonly ownerSessionId: string;
  readonly assistantConsent?: NonNullable<
    NonNullable<McpInvocationScope["client"]>["nativeConsent"]
  >;
  readonly servers: ReadonlyArray<Registration>;
  readonly accepted: Set<CommandId>;
}

interface Attachment {
  readonly scope: McpInvocationScope;
  readonly threadId: ThreadId;
  readonly commandId: CommandId;
  readonly launch?: true;
  readonly assistantLearning?: true;
  readonly servers?: OrchestratorMcpThreadServers | undefined;
}

export class ThreadMcpServers extends Context.Service<
  ThreadMcpServers,
  {
    readonly read: (threadId: ThreadId) => Effect.Effect<ReadonlyArray<ManagedMcpServer>>;
    readonly aroundStandalone: <A, E, R, CheckError>(
      threadId: ThreadId,
      dispatch: Effect.Effect<A, E, R>,
      assertIdle: Effect.Effect<void, CheckError, R>,
    ) => Effect.Effect<A, E | CheckError, R>;
    readonly around: <A, E, R>(
      attachment: Attachment,
      dispatch: Effect.Effect<A, E, R>,
      beforeUpdate?: (topologyChanged: boolean) => Effect.Effect<void, E, R>,
    ) => Effect.Effect<A, E | OrchestratorMcpFailure, R>;
  }
>()("t3/mcp/ThreadMcpServers") {}

function pickHeaders(headers: NodeHttp.IncomingHttpHeaders, names: ReadonlyArray<string>) {
  return Object.fromEntries(
    names.flatMap((name) => {
      const value = headers[name];
      return typeof value === "string" ? [[name, value] as const] : [];
    }),
  );
}

// Only MCP transport headers cross this boundary. In particular, redirects never reach the client.
function forward(
  request: NodeHttp.IncomingMessage,
  response: NodeHttp.ServerResponse,
  entry: Registration,
) {
  const transport = entry.target.protocol === "https:" ? NodeHttps : NodeHttp;
  const upstream = transport.request(
    entry.target,
    {
      method: request.method,
      ...(request.method === "POST" && entry.provider.toolTimeoutMs !== undefined
        ? { signal: AbortSignal.timeout(entry.provider.toolTimeoutMs) }
        : {}),
      headers: {
        ...pickHeaders(request.headers, [
          "accept",
          "content-type",
          "mcp-method",
          "mcp-name",
          "mcp-protocol-version",
          "mcp-session-id",
          "last-event-id",
        ]),
        authorization: Redacted.value(entry.authorization),
      },
    },
    (incoming) => {
      const status = incoming.statusCode ?? 502;
      if (status >= 300 && status < 400) {
        incoming.destroy();
        response.writeHead(502).end();
        return;
      }
      response.writeHead(
        status,
        pickHeaders(incoming.headers, [
          "content-type",
          "content-encoding",
          "mcp-protocol-version",
          "mcp-session-id",
          "retry-after",
        ]),
      );
      incoming.on("error", () => response.destroy());
      incoming.pipe(response);
    },
  );
  upstream.on("error", () => {
    if (response.destroyed) return;
    if (response.headersSent) response.destroy();
    else response.writeHead(502).end();
  });
  response.once("close", () => {
    if (!response.writableFinished) {
      request.unpipe(upstream);
      upstream.destroy();
    }
  });
  request.pipe(upstream);
}

export const layer = (origins: ReadonlySet<string>) =>
  Layer.effect(
    ThreadMcpServers,
    Effect.gen(function* () {
      const threads = new Map<ThreadId, ThreadRegistration>();
      const routes = new Map<string, Registration>();
      const lock = yield* KeyedLock.make<ThreadId>();
      const server = yield* Effect.acquireRelease(
        Effect.tryPromise({
          try: () =>
            new Promise<NodeHttp.Server>((resolve, reject) => {
              const listening = NodeHttp.createServer((req, res) => {
                const address = listening.address();
                const route = routes.get(req.url ?? "");
                if (
                  route === undefined ||
                  req.headers.origin !== undefined ||
                  typeof address !== "object" ||
                  address === null ||
                  req.headers.host !== `127.0.0.1:${address.port}` ||
                  !["GET", "POST", "DELETE"].includes(req.method ?? "")
                ) {
                  res.writeHead(404).end();
                  return;
                }
                forward(req, res, route);
              });
              listening.once("error", reject);
              listening.listen(0, "127.0.0.1", () => resolve(listening));
            }),
          catch: () => attachmentDenied(),
        }),
        (server) =>
          Effect.sync(() => {
            server.close();
            server.closeAllConnections();
          }),
      );
      const address = server.address();
      if (address === null || typeof address === "string") return yield* attachmentDenied();
      const localOrigin = `http://127.0.0.1:${address.port}`;

      const replace = (threadId: ThreadId, next?: ThreadRegistration) => {
        for (const entry of threads.get(threadId)?.servers ?? []) routes.delete(entry.path);
        if (next === undefined) threads.delete(threadId);
        else {
          threads.set(threadId, next);
          for (const entry of next.servers) routes.set(entry.path, entry);
        }
      };

      return ThreadMcpServers.of({
        read: Effect.fn("ThreadMcpServers.read")((threadId: ThreadId) =>
          Effect.sync(() => (threads.get(threadId)?.servers ?? []).map(({ provider }) => provider)),
        ),
        aroundStandalone: Effect.fn("ThreadMcpServers.aroundStandalone")(
          <A, E, R, CheckError>(
            threadId: ThreadId,
            dispatch: Effect.Effect<A, E, R>,
            assertIdle: Effect.Effect<void, CheckError, R>,
          ) => {
            if (!threadId.startsWith("work-learning-") && !threads.get(threadId)?.assistantConsent)
              return dispatch;
            return lock.withLock(
              threadId,
              Effect.gen(function* () {
                yield* assertIdle;
                const previous = threads.get(threadId);
                if (!previous?.servers.length) return yield* dispatch;
                // Preserve the owner and deduplication ledger, but revoke the local tool routes.
                replace(threadId, { ...previous, servers: [] });
                return yield* dispatch;
              }),
            );
          },
        ),
        around: Effect.fn("ThreadMcpServers.around")(
          <A, E, R>(
            input: Attachment,
            dispatch: Effect.Effect<A, E, R>,
            beforeUpdate?: (topologyChanged: boolean) => Effect.Effect<void, E, R>,
          ) => {
            const { client, thread } = input.scope;
            const consent = client?.nativeConsent;
            const previousLearning = threads.get(input.threadId)?.assistantConsent;
            if (
              (input.assistantLearning ||
                previousLearning ||
                input.threadId.startsWith("work-learning-")) &&
              (consent?.audience !== "owner_dm" || !input.servers?.length || thread !== undefined)
            )
              return Effect.fail(attachmentDenied());
            if (client === undefined || thread !== undefined || client.access === "read-only")
              return input.servers === undefined ? dispatch : Effect.fail(attachmentDenied());
            if (input.servers === undefined && !input.launch && !threads.has(input.threadId))
              return dispatch;
            return lock.withLock(
              input.threadId,
              Effect.gen(function* () {
                const previous = threads.get(input.threadId);
                const assistantConsent =
                  input.assistantLearning || previous?.assistantConsent ? consent : undefined;
                if (
                  (previous !== undefined &&
                    Boolean(assistantConsent) !== Boolean(previous.assistantConsent)) ||
                  (previous?.assistantConsent !== undefined &&
                    (assistantConsent === undefined ||
                      !sameLearningOwner(previous.assistantConsent, assistantConsent))) ||
                  (assistantConsent !== undefined && input.servers?.length !== 1)
                )
                  return yield* attachmentDenied();
                if (
                  previous === undefined
                    ? !input.launch
                    : previous.ownerSessionId !== client.sessionId && assistantConsent === undefined
                )
                  return input.servers === undefined ? yield* dispatch : yield* attachmentDenied();
                if (previous?.accepted.has(input.commandId)) return yield* dispatch;
                const authorizations = input.scope.threadMcpAuthorization;
                const entries: Registration[] = [];
                for (const { name, url, headersRef, toolTimeoutMs = 180_000 } of input.servers ??
                  []) {
                  const target = URL.parse(url);
                  const authorization = authorizations?.get(headersRef);
                  if (
                    target === null ||
                    !origins.has(target.origin) ||
                    target.username ||
                    target.password ||
                    target.hash ||
                    target.search ||
                    !authorization ||
                    (assistantConsent !== undefined &&
                      (name !== "atum-agent-tools" ||
                        target.pathname !== `/a/${consent?.binding.agent}/mcp`)) ||
                    name === "t3-code" ||
                    name.startsWith("t3-code-") ||
                    entries.some((entry) => entry.provider.name === name)
                  )
                    return yield* invalid();
                  // A credential rotation keeps the provider-facing endpoint byte-stable.
                  const path =
                    previous?.servers.find(
                      (entry) =>
                        entry.provider.name === name &&
                        entry.target.href === target.href &&
                        entry.provider.toolTimeoutMs === toolTimeoutMs,
                    )?.path ?? `/${NodeCrypto.randomUUID()}`;
                  entries.push({
                    path,
                    provider: { name, url: localOrigin + path, toolTimeoutMs },
                    target,
                    authorization,
                  });
                }
                const next = {
                  ownerSessionId: client.sessionId,
                  ...(assistantConsent === undefined ? {} : { assistantConsent }),
                  servers: input.servers === undefined ? (previous?.servers ?? []) : entries,
                  accepted: previous?.accepted ?? new Set<CommandId>(),
                };
                if (input.servers !== undefined && beforeUpdate !== undefined) {
                  const old = previous?.servers ?? [];
                  yield* beforeUpdate(
                    old.length !== entries.length ||
                      entries.some((entry, i) => entry.path !== old[i]?.path),
                  );
                }
                replace(input.threadId, next);
                return yield* dispatch.pipe(
                  Effect.tap(() =>
                    Effect.sync(() => {
                      next.accepted.add(input.commandId);
                    }),
                  ),
                  Effect.onError(() => Effect.sync(() => replace(input.threadId, previous))),
                );
              }),
            );
          },
        ),
      });
    }),
  );

export const configure = (configuredOrigins: string | undefined) => {
  if (configuredOrigins === undefined) return undefined;
  const origins = new Set<string>();
  for (const origin of configuredOrigins.split(",")) {
    const url = URL.parse(origin.trim());
    if (
      url === null ||
      url.href !== url.origin + "/" ||
      url.hostname.includes("*") ||
      (url.protocol !== "https:" && !(url.protocol === "http:" && url.hostname === "127.0.0.1"))
    )
      return undefined;
    origins.add(url.origin);
  }
  return layer(origins);
};

export function authorizationReferences(header: string | undefined) {
  if (header === undefined || header.length > 8_192) return undefined;
  try {
    const value: unknown = JSON.parse(header);
    if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
    return new Map(
      Object.entries(value).flatMap(([key, authorization]) =>
        typeof authorization === "string" &&
        /^Bearer [A-Za-z0-9._~+/=-]{1,2048}$/.test(authorization)
          ? [[key, Redacted.make(authorization)] as const]
          : [],
      ),
    );
  } catch {
    return undefined;
  }
}

export const aroundDispatch = <A, E, R>(
  input: Attachment,
  dispatch: Effect.Effect<A, E, R>,
  beforeUpdate?: (topologyChanged: boolean) => Effect.Effect<void, E, R>,
) =>
  Effect.serviceOption(ThreadMcpServers).pipe(
    Effect.flatMap((relay) =>
      Option.isSome(relay)
        ? relay.value.around(input, dispatch, beforeUpdate)
        : input.servers === undefined
          ? dispatch
          : Effect.fail(attachmentDenied()),
    ),
  );
