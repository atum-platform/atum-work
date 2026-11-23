// @effect-diagnostics nodeBuiltinImport:off -- A synchronous check is required at transcript boundaries.
import * as NodeCrypto from "node:crypto";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

export const protectedDirectory = process.env.ATUM_WORK_CONNECTOR_PROTECTED_DIR;
const policyPath = process.env.ATUM_WORK_CONNECTOR_POLICY;
delete process.env.ATUM_WORK_CONNECTOR_PROTECTED_DIR;
delete process.env.ATUM_WORK_CONNECTOR_POLICY;

export const workPolicyPath = () => policyPath;
export const managedInstance = "atum-managed";

function marker(threadId: string) {
  return NodePath.join(
    protectedDirectory!,
    NodeCrypto.createHash("sha256").update(threadId).digest("hex"),
  );
}

export function isProtectedThread(threadId: string): boolean {
  if (!protectedDirectory) return false;
  try {
    NodeFS.statSync(marker(threadId));
    return true;
  } catch (error) {
    // A broken or unreadable store never permits a transfer to another provider.
    return (error as NodeJS.ErrnoException).code !== "ENOENT";
  }
}

function sync(path: string, flags: string, mode?: number) {
  const fd = NodeFS.openSync(path, flags, mode);
  try {
    NodeFS.fsyncSync(fd);
  } finally {
    NodeFS.closeSync(fd);
  }
}

export function protectThread(threadId: string): boolean {
  if (!protectedDirectory || !policyPath) return false;
  try {
    NodeFS.mkdirSync(protectedDirectory, { recursive: true, mode: 0o700 });
    sync(marker(threadId), "a", 0o600);
    sync(protectedDirectory, "r");
    sync(NodePath.dirname(protectedDirectory), "r");
    return true;
  } catch {
    return false;
  }
}
