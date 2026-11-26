// @effect-diagnostics nodeBuiltinImport:off - Use a real loopback connector fixture.
import * as NodeCrypto from "node:crypto";
import * as NodeHttp from "node:http";
import { Effect } from "effect";
import { it } from "@effect/vitest";
import { expect } from "vite-plus/test";

import { readConnectorMcpServers } from "./ManagedMcpServers.ts";

it.live(
  "only configures current connector routes and keeps project names and credentials separate",
  () =>
    Effect.gen(function* () {
      let token = "a".repeat(43);
      const mac = (message: string) =>
        NodeCrypto.createHmac("sha256", token).update(message).digest("base64url");
      const requests: Array<{ method: string | undefined; authorization: string | undefined }> = [];
      let replayedProof: string | undefined;
      let stale = false;
      const listener = NodeHttp.createServer((request, response) => {
        const url = new URL(request.url ?? "", "http://127.0.0.1");
        requests.push({ method: request.method, authorization: request.headers.authorization });
        const nonce = url.searchParams.get("nonce");
        if (url.pathname !== "/mcp/health" || nonce === null) {
          response.writeHead(404).end();
          return;
        }
        const proof = stale ? replayedProof! : mac(`atum-work-mcp-health-v1:${nonce}`);
        replayedProof = proof;
        response.writeHead(204, { "x-atum-work-mcp-proof": proof }).end();
      });
      yield* Effect.promise(
        () =>
          new Promise<void>((resolve, reject) => {
            listener.once("error", reject);
            listener.listen(0, "127.0.0.1", resolve);
          }),
      );
      const address = listener.address();
      if (address === null || typeof address === "string")
        throw new Error("Expected a loopback address");
      const origin = `http://127.0.0.1:${address.port}`;
      const endpoint = `${origin}/ask`;
      const read = (secret: string | undefined) => readConnectorMcpServers(endpoint, secret);

      try {
        expect(yield* read(undefined)).toEqual([]);
        expect(yield* readConnectorMcpServers(`${origin}/other`, token)).toEqual([]);
        const initial = yield* read(token);
        expect(initial.map((server) => server.url)).toEqual([
          `${origin}/mcp/google`,
          `${origin}/mcp/owner-chats`,
        ]);
        expect(initial.map((server) => server.name)).toEqual([
          expect.stringMatching(/^atum-account-google-[0-9a-f]{16}$/),
          expect.stringMatching(/^atum-account-owner-chats-[0-9a-f]{16}$/),
        ]);
        expect(initial[0]?.authorizationHeader).toBe(`Bearer ${mac("atum-work-mcp-bearer-v1")}`);
        expect(initial[0]?.authorizationHeader).not.toContain(token);
        expect(yield* read(token)).toEqual(initial);

        token = "b".repeat(43);
        const replacement = yield* read(token);
        expect(replacement.map((server) => server.name)).not.toEqual(
          initial.map((server) => server.name),
        );
        stale = true;
        expect(yield* read(token)).toEqual([]);
        expect(requests).toEqual(
          Array.from({ length: 4 }, () => ({ method: "HEAD", authorization: undefined })),
        );
      } finally {
        yield* Effect.promise(
          () => new Promise<void>((resolve) => listener.close(() => resolve())),
        );
      }
      expect(yield* read(token)).toEqual([]);
    }),
);
