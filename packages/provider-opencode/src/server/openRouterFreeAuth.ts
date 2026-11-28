// The browser callback needs an ephemeral loopback port and the caller's abort signal.
// @effect-diagnostics nodeBuiltinImport:off globalFetch:off
import * as NodeCrypto from "node:crypto";
import * as NodeHttp from "node:http";
import * as NodeSqlite from "node:sqlite";
import type { OpenCodeClient } from "@opencode/client/effect";
import { Integration } from "@opencode/schema/integration";
import type { ProviderInstanceId } from "@t3tools/contracts";
import { ProviderSetupError } from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

const openRouter = Integration.ID.make("openrouter");
const decodeKey = Schema.decodeUnknownSync(
  Schema.Struct({ key: Schema.String.check(Schema.isMinLength(1)) }),
);
const decodeQuota = Schema.decodeUnknownSync(
  Schema.Struct({
    data: Schema.Struct({
      free_model_daily_requests: Schema.optionalKey(
        Schema.Struct({
          limit: Schema.Number,
          remaining: Schema.Number,
        }),
      ),
    }),
  }),
);

// Independent implementation of OpenRouter's published OAuth PKCE protocol.
// https://openrouter.ai/docs/guides/overview/auth/oauth
export async function authorizeOpenRouter(
  openBrowser: (url: string) => Promise<void>,
  signal: AbortSignal,
) {
  const verifier = NodeCrypto.randomBytes(32).toString("base64url");
  const noncePath = `/openrouter/${NodeCrypto.randomBytes(24).toString("base64url")}`;
  const challenge = NodeCrypto.createHash("sha256").update(verifier).digest("base64url");
  const code = await new Promise<string>((resolve, reject) => {
    const failed = () => finish(undefined);
    const finish = (code?: string) => {
      signal.removeEventListener("abort", failed);
      server.closeAllConnections();
      server.close();
      if (code) resolve(code);
      else reject(new Error("OpenRouter sign-in did not complete."));
    };
    const server = NodeHttp.createServer((request, response) => {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      if (request.method !== "GET" || url.pathname !== noncePath) {
        response.writeHead(404).end();
        return;
      }
      const code = url.searchParams.get("code");
      response
        .writeHead(code ? 200 : 400, {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
          "Referrer-Policy": "no-referrer",
        })
        .end(
          code
            ? "Return to Atum to finish connecting OpenRouter."
            : "OpenRouter sign-in was cancelled.",
          () => finish(code ?? undefined),
        );
    });
    server.once("error", failed);
    signal.addEventListener("abort", failed, { once: true });
    if (signal.aborted) return failed();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") return failed();
      const auth = new URL("https://openrouter.ai/auth");
      auth.search = new URLSearchParams({
        callback_url: `http://127.0.0.1:${address.port}${noncePath}`,
        code_challenge: challenge,
        code_challenge_method: "S256",
      }).toString();
      void openBrowser(auth.href).catch(failed);
    });
  });

  const response = await fetch("https://openrouter.ai/api/v1/auth/keys", {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, code_verifier: verifier, code_challenge_method: "S256" }),
  });
  if (!response.ok) throw new Error("OpenRouter did not return a key.");
  return decodeKey(await response.json()).key;
}

/** A cancelled setup can leave a database without an active OpenRouter key. */
export const hasOpenRouterCredential = (databasePath: string) =>
  Effect.sync(() => {
    try {
      const database = new NodeSqlite.DatabaseSync(databasePath, { readOnly: true });
      try {
        return (
          database
            .prepare("SELECT 1 FROM credential WHERE integration_id = ? AND active = 1 LIMIT 1")
            .get(openRouter) !== undefined
        );
      } finally {
        database.close();
      }
    } catch {
      // A missing or unmigrated DB cannot contain an active OpenRouter credential.
      return false;
    }
  });

const storedKeys = (client: OpenCodeClient) =>
  client.credential
    .list()
    .pipe(
      Effect.map((entries) => entries.filter(({ integrationID }) => integrationID === openRouter)),
    );

export const saveOpenRouterKey = (client: OpenCodeClient, key: string) =>
  storedKeys(client).pipe(
    Effect.flatMap((old) =>
      client.integration.connect.key({ integrationID: openRouter, key, label: "Atum Work" }).pipe(
        Effect.andThen(
          Effect.forEach(old, ({ id }) => client.credential.remove({ credentialID: id }), {
            discard: true,
          }),
        ),
      ),
    ),
  );

export const removeOpenRouterKeys = (client: OpenCodeClient) =>
  storedKeys(client).pipe(
    Effect.flatMap((keys) =>
      Effect.forEach(keys, ({ id }) => client.credential.remove({ credentialID: id }), {
        discard: true,
      }),
    ),
  );

async function fetchOpenRouterQuota(key: string, signal: AbortSignal) {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/key", {
      headers: { Authorization: `Bearer ${key}` },
      redirect: "error",
      signal,
    });
    if (response.status === 401) return { unauthorized: true as const };
    if (!response.ok) return;
    return { unauthorized: false as const, ...decodeQuota(await response.json()).data };
  } catch {
    return undefined;
  }
}

export const readOpenRouterQuota = Effect.fn("readOpenRouterQuota")(function* (
  client: OpenCodeClient,
) {
  const active = (yield* storedKeys(client)).find(({ active }) => active)?.value;
  if (active?.type !== "key") return { authenticated: false, limits: undefined };
  const quota = yield* Effect.promise((signal) => fetchOpenRouterQuota(active.key, signal)).pipe(
    Effect.timeout("4 seconds"),
    Effect.orElseSucceed(() => undefined),
  );
  const daily = quota && !quota.unauthorized && quota.free_model_daily_requests;
  const now = yield* DateTime.now;
  const resetAt = DateTime.startOf(DateTime.add(now, { days: 1 }), "day");
  return {
    authenticated: quota?.unauthorized !== true,
    limits:
      daily &&
      Number.isSafeInteger(daily.limit) &&
      Number.isSafeInteger(daily.remaining) &&
      daily.limit > 0 &&
      daily.remaining >= 0 &&
      daily.remaining <= daily.limit
        ? {
            checkedAt: DateTime.formatIso(now),
            windows: [
              {
                id: "openrouter-free-daily",
                kind: "other" as const,
                label: `${daily.remaining} free requests left today`,
                usedPercent: (100 * (daily.limit - daily.remaining)) / daily.limit,
                resetsAt: DateTime.formatIso(resetAt),
              },
            ],
          }
        : undefined,
  };
});

export const openRouterSetupError = (
  instanceId: ProviderInstanceId,
  operation: string,
  detail: string,
) => new ProviderSetupError({ instanceId, operation, detail });
