// @effect-diagnostics globalFetch:off
// @effect-diagnostics nodeBuiltinImport:off -- Native session binding, never model input.
import * as NodeFSP from "node:fs/promises";
import * as NodeCrypto from "node:crypto";
import { nativeThreadGrant } from "./forwardAdmission.ts";
import type { Caller } from "./connector.ts";

export const callerFile = (path: string, caller: Caller) =>
  `${path}.callers/${NodeCrypto.createHash("sha256").update(JSON.stringify(caller)).digest("hex")}.json`;
export async function provisionNativeCaller(input: {
  forwardPath: string;
  grantsPath: string;
  endpoint: string;
  token: string;
  caller: Caller;
}) {
  const grant = await nativeThreadGrant(input.forwardPath, input.caller.threadId);
  if (!grant) return;
  const session = (grant as typeof grant & { hermesSessionId?: string }).hermesSessionId;
  if (!session) throw new Error("Hermes session binding unavailable");
  const bound = {
    ...input.caller,
    binding: grant.binding,
    actor: grant.actor,
    audience: grant.audience,
    expiresAt: grant.expiresAt,
    enabled: grant.enabled,
  };
  const registration = {
    binding: grant.binding,
    audience: { owner: grant.binding.owner, actor: grant.actor, kind: grant.audience },
    caller: input.caller,
    hermesSessionId: session,
    mcpServer: `work-${grant.binding.mac}`,
    expiresAt: grant.expiresAt,
  };
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
    throw new Error("Private connector unavailable");
  url.pathname = "/native-register";
  const response = await fetch(url, {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(10000),
    headers: { authorization: `Bearer ${input.token}`, "content-type": "application/json" },
    body: JSON.stringify(registration),
  });
  if (!response.ok) throw new Error("Cloud agent registration unavailable");
  await NodeFSP.mkdir(`${input.grantsPath}.callers`, { recursive: true, mode: 0o700 });
  const target = callerFile(input.grantsPath, input.caller);
  await NodeFSP.writeFile(target, JSON.stringify(bound), { mode: 0o600 });
}
