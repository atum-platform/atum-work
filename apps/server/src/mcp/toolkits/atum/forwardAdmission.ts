// @effect-diagnostics globalDate:off
// @effect-diagnostics nodeBuiltinImport:off -- Private consent adapter state, never model arguments.
import * as Schema from "effect/Schema";
import * as NodeFSP from "node:fs/promises";
import * as NodeCrypto from "node:crypto";

export interface ForwardGrant {
  clientId: string;
  binding: {
    owner: string;
    agent: string;
    generation: string;
    mac: string;
    consent_revision: number;
  };
  actor: string;
  audience: "owner_dm" | "owner_schedule";
  expiresAt: number;
  enabled: boolean;
}
export const forwardGrantsFile = process.env.ATUM_WORK_FORWARD_GRANTS_FILE;
delete process.env.ATUM_WORK_FORWARD_GRANTS_FILE;

async function privateJson(path: string): Promise<unknown> {
  const stat = await NodeFSP.lstat(path);
  if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0 || stat.size > 1048576)
    throw new Error("Invalid consent snapshot");
  return JSON.parse(await NodeFSP.readFile(path, "utf8"));
}
export async function forwardGrant(
  path: string,
  clientId: string,
  now = Date.now(),
): Promise<ForwardGrant> {
  const rows = await privateJson(path);
  if (!Array.isArray(rows)) throw new Error("Consent unavailable");
  const matches = rows.filter((g: ForwardGrant) => g.clientId === clientId);
  const g = matches[0] as ForwardGrant | undefined;
  if (
    matches.length !== 1 ||
    !g ||
    !g.enabled ||
    !Number.isFinite(g.expiresAt) ||
    g.expiresAt <= now ||
    !g.binding ||
    ![g.binding.owner, g.binding.agent, g.binding.generation, g.binding.mac].every(
      (v) => typeof v === "string" && v.length > 0,
    ) ||
    g.actor !== g.binding.owner ||
    !["owner_dm", "owner_schedule"].includes(g.audience) ||
    !Number.isSafeInteger(g.binding.consent_revision) ||
    g.binding.consent_revision < 1
  )
    throw new Error("Owner consent required");
  return g;
}
const digest = (token: string) => NodeCrypto.createHash("sha256").update(token).digest("hex");
// Each bearer has its own atomic record. Concurrent sign-ins never overwrite each other.
export async function bindForwardToken(path: string, token: string, clientId: string) {
  const grant = await forwardGrant(path, clientId);
  const directory = `${path}.sessions`;
  await NodeFSP.mkdir(directory, { recursive: true, mode: 0o700 });
  await NodeFSP.writeFile(`${directory}/${digest(token)}.json`, JSON.stringify(grant), {
    mode: 0o600,
    flag: "wx",
  });
}
export async function admitForwardToken(path: string, token: string): Promise<ForwardGrant> {
  const saved = (await privateJson(`${path}.sessions/${digest(token)}.json`)) as ForwardGrant;
  const fresh = await forwardGrant(path, saved.clientId);
  // Reapproval mints a new bearer; an old bearer cannot acquire a new generation/revision.
  if (JSON.stringify(saved) !== JSON.stringify(fresh))
    throw new Error("Consent changed; reapprove");
  return fresh;
}

export class ForwardAdmissionError extends Schema.TaggedError<ForwardAdmissionError>()(
  "ForwardAdmissionError",
  { message: Schema.String },
) {}

export const consentFingerprint = (grant: ForwardGrant) => JSON.stringify(grant);

export async function bindNativeThread(path: string, threadId: string, grant: ForwardGrant) {
  const directory = `${path}.threads`;
  await NodeFSP.mkdir(directory, { recursive: true, mode: 0o700 });
  const target = `${directory}/${digest(threadId)}.json`;
  const bytes = JSON.stringify(grant);
  try { await NodeFSP.writeFile(target, bytes, { mode: 0o600, flag: "wx" }); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const existing = await privateJson(target) as ForwardGrant;
    if (existing.clientId !== grant.clientId || JSON.stringify(existing.binding) !== JSON.stringify(grant.binding))
      throw new ForwardAdmissionError({ message: "Native thread binding changed" });
  }
}
export async function nativeThreadGrant(path: string, threadId: string): Promise<ForwardGrant | undefined> {
  let saved: ForwardGrant;
  try { saved = await privateJson(`${path}.threads/${digest(threadId)}.json`) as ForwardGrant; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined; throw error; }
  const fresh = await forwardGrant(path, saved.clientId);
  if (JSON.stringify(saved.binding) !== JSON.stringify(fresh.binding)) throw new ForwardAdmissionError({ message: "Native thread consent changed" });
  return fresh;
}
