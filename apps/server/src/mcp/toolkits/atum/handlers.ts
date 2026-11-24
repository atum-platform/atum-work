import * as McpProviderSessions from "@t3tools/provider-core/server/McpProviderSessions";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as McpSessionRegistry from "../../McpSessionRegistry.ts";
import * as McpToolAccess from "../../McpToolAccess.ts";
import { assertLiveCaller, loadCaller, unavailable } from "../../threadAccess.ts";
import * as ThreadCommandExecutor from "../../../orchestration-v2/ThreadCommandExecutor.ts";
import { registerAdmission } from "./admission.ts";
import { endpoint, token, grantsFile } from "./config.ts";
import { askConnector } from "./connector.ts";
import { boundRegistry } from "./boundRegistry.ts";
import { AtumToolkit } from "./tools.ts";

export const layer = McpToolAccess.toLayer(AtumToolkit, {
  ask_my_agent: McpToolAccess.actsAsCaller((question) =>
    Effect.gen(function* () {
      const caller = yield* loadCaller();
      yield* assertLiveCaller(caller);
      const thread = caller.scope.thread;
      if (!thread || caller.scope.client || caller.caller?.linkOrigin) {
        return yield* unavailable();
      }
      const sessions = yield* McpProviderSessions.McpProviderSessions;
      const registry = yield* McpSessionRegistry.McpSessionRegistry;
      const { threadId, providerSessionId, providerInstanceId } = thread;
      const current = Effect.gen(function* () {
        const fresh = yield* loadCaller();
        yield* assertLiveCaller(fresh);
        if (
          !fresh.caller ||
          fresh.caller.linkOrigin ||
          fresh.caller.modelSelection.instanceId !== providerInstanceId ||
          fresh.caller.activeRunId !== caller.caller?.activeRunId
        ) {
          return false;
        }
        const session = yield* sessions.read(threadId);
        if (
          session?.providerSessionId !== providerSessionId ||
          session.providerInstanceId !== providerInstanceId
        ) {
          return false;
        }
        const resolved = yield* registry.resolve(
          session.authorizationHeader.replace(/^Bearer\s+/, ""),
        );
        return resolved?.thread.providerSessionId === providerSessionId;
      }).pipe(Effect.orElseSucceed(() => false));
      const lock = yield* ThreadCommandExecutor.ThreadCommandExecutor;
      const check = lock.withLock(threadId, current);
      const runCheck = Effect.runPromiseWith(
        yield* Effect.context<Effect.Services<typeof check>>(),
      );
      const runCurrent = Effect.runPromiseWith(
        yield* Effect.context<Effect.Services<typeof current>>(),
      );
      return yield* Effect.tryPromise({
        try: async (signal) => {
          const binding = { threadId, providerSessionId, providerInstanceId };
          const admission = registerAdmission(binding, () =>
            signal.aborted ? Promise.resolve(false) : runCheck(check, { signal }),
          );
          try {
            return await askConnector({
              caller: binding,
              question,
              endpoint,
              token,
              signal,
              current: () => runCurrent(current),
              admission: admission.id,
            });
          } finally {
            admission.close();
          }
        },
        catch: unavailable,
      });
    }),
  ),
  agent_tools: McpToolAccess.actsAsCaller((request) =>
    Effect.gen(function* () {
      const caller = yield* loadCaller();
      yield* assertLiveCaller(caller);
      const thread = caller.scope.thread;
      if (!thread || caller.scope.client || caller.caller?.linkOrigin) {
        return yield* unavailable();
      }
      const sessions = yield* McpProviderSessions.McpProviderSessions;
      const registry = yield* McpSessionRegistry.McpSessionRegistry;
      const { threadId, providerSessionId, providerInstanceId } = thread;
      const current = Effect.gen(function* () {
        const fresh = yield* loadCaller();
        yield* assertLiveCaller(fresh);
        if (
          !fresh.caller ||
          fresh.caller.linkOrigin ||
          fresh.caller.modelSelection.instanceId !== providerInstanceId ||
          fresh.caller.activeRunId !== caller.caller?.activeRunId
        ) {
          return false;
        }
        const session = yield* sessions.read(threadId);
        if (
          session?.providerSessionId !== providerSessionId ||
          session.providerInstanceId !== providerInstanceId
        ) {
          return false;
        }
        const resolved = yield* registry.resolve(
          session.authorizationHeader.replace(/^Bearer\s+/, ""),
        );
        return resolved?.thread.providerSessionId === providerSessionId;
      }).pipe(Effect.orElseSucceed(() => false));
      const lock = yield* ThreadCommandExecutor.ThreadCommandExecutor;
      const check = lock.withLock(threadId, current);
      const runCheck = Effect.runPromiseWith(
        yield* Effect.context<Effect.Services<typeof check>>(),
      );
      const clock = yield* Clock.Clock;
      return yield* Effect.tryPromise({
        try: async (signal) => {
          const binding = { threadId, providerSessionId, providerInstanceId };
          return await boundRegistry({
            caller: binding,
            request,
            endpoint,
            token,
            grantsFile,
            signal,
            now: () => Promise.resolve(clock.currentTimeMillisUnsafe()),
            current: () => runCheck(check, { signal }),
          });
        },
        catch: unavailable,
      });
    }),
  ),
});
