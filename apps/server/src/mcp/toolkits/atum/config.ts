// @effect-diagnostics nodeBuiltinImport:off -- Read the private startup pipe before providers can start.
import * as NodeFS from "node:fs";

export const grantsFile = process.env.ATUM_WORK_BINDINGS_FILE;
delete process.env.ATUM_WORK_BINDINGS_FILE;

export const endpoint = process.env.ATUM_WORK_CONNECTOR_URL;
const descriptor = process.env.ATUM_WORK_CONNECTOR_FD;
delete process.env.ATUM_WORK_CONNECTOR_URL;
delete process.env.ATUM_WORK_CONNECTOR_FD;

export const token = (() => {
  if (!descriptor || !/^[0-9]+$/.test(descriptor)) return undefined;
  const fd = Number(descriptor);
  if (!Number.isSafeInteger(fd) || fd < 3) return undefined;
  try {
    const value = NodeFS.readFileSync(fd, "utf8");
    return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : undefined;
  } finally {
    NodeFS.closeSync(fd);
  }
})();
export const configured = () => endpoint !== undefined && token !== undefined;
