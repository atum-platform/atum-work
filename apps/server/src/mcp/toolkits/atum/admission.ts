// @effect-diagnostics nodeBuiltinImport:off -- Private one-time challenge authentication.
import * as NodeCrypto from "node:crypto";
import * as Effect from "effect/Effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";
import { token } from "./config.ts";
import type { Caller } from "./connector.ts";

interface Admission {
  binding: string;
  check(): Promise<boolean>;
}

const pending = new Map<string, Admission>();

export function registerAdmission(caller: Caller, check: Admission["check"]) {
  const id = NodeCrypto.randomUUID();
  const binding = Buffer.from(
    JSON.stringify([caller.threadId, caller.providerSessionId, caller.providerInstanceId]),
  ).toString("base64url");
  pending.set(id, { binding, check });
  return { id, close: () => pending.delete(id) };
}

// Main calls this on the known live sidecar origin, using its startup secret.
// Only an in-flight native MCP invocation can supply this challenge.
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
    const admission = pending.get(id);
    if (!admission || admission.binding !== headers["x-atum-work-caller"]) {
      return HttpServerResponse.empty({ status: 409 });
    }
    const live = yield* Effect.promise(() => admission.check().catch(() => false));
    return HttpServerResponse.empty({
      status: live && pending.get(id) === admission ? 204 : 409,
    });
  }),
);
