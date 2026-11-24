import { forwardGrantsFile, nativeThreadGrant } from "./forwardAdmission.ts";
import { callerFile, provisionNativeCaller } from "./nativeCaller.ts";
// @effect-diagnostics nodeBuiltinImport:off -- Owner-managed consent snapshot, reread per operation.
import * as NodeFSP from "node:fs/promises";
import type { Caller } from "./connector.ts";

export interface AgentBinding {
  owner: string;
  agent: string;
  generation: string;
  mac: string;
  consent_revision: number;
}
export interface BoundGrant {
  binding: AgentBinding;
  actor: string;
  audience: "owner_dm" | "owner_schedule";
  threadId: string;
  providerSessionId: string;
  providerInstanceId: string;
  expiresAt: number;
  enabled: boolean;
}
// This file is written only by the trusted consent adapter, never by model arguments.
// Removing/disabling it revokes all reverse calls without restarting Work.
export async function readGrant(
  path: string | undefined,
  caller: Caller,
  now: number,
): Promise<BoundGrant> {
  if (!path) throw new Error("Agent binding unavailable");
  let grants: BoundGrant[];
  try {
    grants = JSON.parse(await NodeFSP.readFile(path, "utf8")) as BoundGrant[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    grants = [];
  }
  if (
    !grants.some(
      (g) =>
        g.threadId === caller.threadId &&
        g.providerSessionId === caller.providerSessionId &&
        g.providerInstanceId === caller.providerInstanceId,
    )
  ) {
    grants = [JSON.parse(await NodeFSP.readFile(callerFile(path, caller), "utf8")) as BoundGrant];
  }
  const grant = grants.find(
    (g) =>
      g.threadId === caller.threadId &&
      g.providerSessionId === caller.providerSessionId &&
      g.providerInstanceId === caller.providerInstanceId,
  );
  if (
    !grant ||
    !grant.enabled ||
    !Number.isFinite(grant.expiresAt) ||
    grant.expiresAt <= now ||
    !grant.binding.owner ||
    grant.actor !== grant.binding.owner ||
    !["owner_dm", "owner_schedule"].includes(grant.audience) ||
    !grant.binding.agent ||
    !grant.binding.generation ||
    !grant.binding.mac ||
    !Number.isSafeInteger(grant.binding.consent_revision) ||
    grant.binding.consent_revision < 1
  )
    throw new Error("Stale or foreign agent binding");
  if (forwardGrantsFile) {
    const current = await nativeThreadGrant(forwardGrantsFile, caller.threadId);
    if (!current || JSON.stringify(current.binding) !== JSON.stringify(grant.binding))
      throw new Error("Native consent revoked");
  }
  return grant;
}

export async function boundRegistry(input: {
  caller: Caller;
  request: { operation: "list" | "call"; name?: string; arguments?: unknown };
  endpoint: string | undefined;
  token: string | undefined;
  grantsFile: string | undefined;
  current(): Promise<boolean>;
  now(): Promise<number>;
  signal?: AbortSignal;
  fetch?: typeof globalThis.fetch;
}): Promise<unknown> {
  if (!(await input.current())) throw new Error("Native session unavailable");
  if (forwardGrantsFile && input.grantsFile && input.endpoint && input.token) {
    await provisionNativeCaller({
      forwardPath: forwardGrantsFile,
      grantsPath: input.grantsFile,
      endpoint: input.endpoint,
      token: input.token,
      caller: input.caller,
    });
  }
  const grant = await readGrant(input.grantsFile, input.caller, await input.now());
  if (!input.endpoint || !input.token || !(await input.current())) throw new Error("Unavailable");
  // Reuse the existing private local connector; it carries cloud auth, not the provider.
  const url = new URL(input.endpoint);
  if (
    url.protocol !== "http:" ||
    url.hostname !== "127.0.0.1" ||
    url.pathname !== "/ask" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error("Invalid connector");
  url.pathname = "/tools";
  const response = await (input.fetch ?? globalThis.fetch)(url, {
    method: "POST",
    redirect: "error",
    signal: input.signal
      ? AbortSignal.any([input.signal, AbortSignal.timeout(55_000)])
      : AbortSignal.timeout(55_000),
    headers: { authorization: `Bearer ${input.token}`, "content-type": "application/json" },
    body: JSON.stringify({
      caller: input.caller,
      binding: grant.binding,
      audience: {
        owner: grant.binding.owner,
        actor: grant.actor,
        kind: grant.audience,
      },
      ...input.request,
    }),
  });
  const fresh = await readGrant(input.grantsFile, input.caller, await input.now());
  if (!response.ok || !(await input.current()) || JSON.stringify(fresh) !== JSON.stringify(grant))
    throw new Error("Binding revoked during call");
  return response.json();
}
