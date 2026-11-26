// @effect-diagnostics nodeBuiltinImport:off - Disposable loopback spike fed by a trusted inherited descriptor.
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import type { ManagedMcpServer } from "@t3tools/provider-core/server/mcpSession";

const NAME = "hermes-slice0";

interface Attachment {
  readonly threadId: string;
  readonly origin: string;
  readonly bearer: string;
  readonly expiresAt: number;
}

export function selectModeBProofAttachment(
  current: Attachment | undefined,
  threadId: string,
  now = Date.now(),
): ReadonlyArray<ManagedMcpServer> {
  if (
    current == null ||
    threadId !== current.threadId ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(threadId) ||
    !/^http:\/\/127\.0\.0\.1:[1-9][0-9]{0,4}$/.test(current.origin) ||
    !/^[A-Za-z0-9_-]{43}$/.test(current.bearer) ||
    !Number.isFinite(current.expiresAt) ||
    now >= current.expiresAt
  ) {
    return [];
  }
  return [
    {
      name: NAME,
      url: `${current.origin}/bound/${threadId}`,
      authorizationHeader: `Bearer ${current.bearer}`,
    },
  ];
}

const descriptor = process.env.MODEB_SLICE0_ATTACHMENT_FD;
let current: Attachment | undefined;
if (descriptor !== undefined && /^[0-9]+$/.test(descriptor)) {
  delete process.env.MODEB_SLICE0_ATTACHMENT_FD;
  const input = createReadStream("", { fd: Number(descriptor) });
  input.on("error", () => { current = undefined; });
  createInterface({ input }).on("line", (line) => {
    try {
      current = JSON.parse(line) as Attachment | undefined;
    } catch {
      current = undefined;
    }
  }).on("close", () => { current = undefined; });
}

export function readModeBProofAttachment(threadId: string): ReadonlyArray<ManagedMcpServer> {
  return selectModeBProofAttachment(current, threadId);
}
