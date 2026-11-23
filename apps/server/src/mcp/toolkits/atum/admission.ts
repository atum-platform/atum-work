// @effect-diagnostics nodeBuiltinImport:off -- Private one-time challenge authentication.
import * as NodeCrypto from "node:crypto";
import * as Effect from "effect/Effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";
import { token } from "./config.ts";

const pending = new Map<string, () => Promise<boolean>>();

export function registerAdmission(prepare: () => Promise<boolean>) {
  const id = NodeCrypto.randomUUID();
  pending.set(id, prepare);
  return { id, close: () => pending.delete(id) };
}

// Main calls this on the known live sidecar origin, using its startup secret.
// Only an in-flight native MCP invocation can supply the one-time challenge.
export const layer = HttpRouter.add(
  "POST",
  "/atum-work/connector/prepare",
  Effect.gen(function* () {
    const { headers } = yield* HttpServerRequest.HttpServerRequest;
    const provided = Buffer.from(headers.authorization ?? "");
    const expected = Buffer.from(`Bearer ${token ?? ""}`);
    if (
      !token ||
      provided.length !== expected.length ||
      !NodeCrypto.timingSafeEqual(provided, expected)
    ) {
      return HttpServerResponse.empty({ status: 404 });
    }
    const id = headers["x-atum-work-admission"] ?? "";
    const prepare = pending.get(id);
    pending.delete(id);
    const allowed = prepare ? yield* Effect.promise(() => prepare().catch(() => false)) : false;
    return HttpServerResponse.empty({ status: allowed ? 204 : 409 });
  }),
);
