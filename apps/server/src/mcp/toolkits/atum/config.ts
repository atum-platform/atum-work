// @effect-diagnostics nodeBuiltinImport:off -- Read the private startup pipe before providers can start.
import * as NodeFS from "node:fs";

export const grantsFile = process.env.ATUM_WORK_BINDINGS_FILE;
delete process.env.ATUM_WORK_BINDINGS_FILE;

export const endpoint = process.env.ATUM_WORK_CONNECTOR_URL;
// The host may route bound tools directly to the S2 private listener while
// keeping ask_my_agent on its existing connector.
export const toolsEndpoint = process.env.ATUM_WORK_TOOLS_CONNECTOR_URL ?? endpoint;
delete process.env.ATUM_WORK_TOOLS_CONNECTOR_URL;
const descriptor = process.env.ATUM_WORK_CONNECTOR_FD;
delete process.env.ATUM_WORK_CONNECTOR_URL;
delete process.env.ATUM_WORK_CONNECTOR_FD;
delete process.env.ATUM_WORK_CONNECTOR_TOKEN;

export const token = (() => {
  if (!descriptor || !/^[0-9]+$/.test(descriptor)) return undefined;
  const fd = Number(descriptor);
  if (!Number.isSafeInteger(fd) || fd < 3 || fd > 0x7fff_ffff) return undefined;
  try {
    if (!NodeFS.fstatSync(fd).isFIFO()) return undefined;
    try {
      const value = NodeFS.readFileSync(fd, "utf8");
      return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : undefined;
    } finally {
      NodeFS.closeSync(fd);
    }
  } catch {
    return undefined;
  }
})();
export const configured = () =>
  (endpoint !== undefined || toolsEndpoint !== undefined) && token !== undefined;
