import * as Effect from "effect/Effect";
import * as McpToolAccess from "../../McpToolAccess.ts";
import {
  assertLiveCaller,
  loadCaller,
  unavailable,
} from "../../threadAccess.ts";
import { askConnector } from "./connector.ts";
import { AtumToolkit } from "./tools.ts";
import { endpoint, token } from "./config.ts";
export const layer = McpToolAccess.toLayer(AtumToolkit, {
  ask_my_agent: McpToolAccess.actsAsCaller((question) =>
    Effect.gen(function* () {
      const caller = yield* loadCaller();
      yield* assertLiveCaller(caller);
      const thread = caller.scope.thread;
      if (!thread || caller.scope.client || caller.caller?.linkOrigin)
        return yield* unavailable();
      const current = Effect.gen(function* () {
        const fresh = yield* loadCaller();
        yield* assertLiveCaller(fresh);
        return (
          fresh.caller?.modelSelection.instanceId === thread.providerInstanceId
        );
      }).pipe(Effect.orElseSucceed(() => false));
      const runCurrent = Effect.runPromiseWith(
        yield* Effect.context<Effect.Services<typeof current>>(),
      );
      return yield* Effect.tryPromise({
        try: () =>
          askConnector({
            caller: thread,
            question,
            endpoint,
            token,
            current: () => runCurrent(current),
          }),
        catch: unavailable,
      });
    }),
  ),
});
