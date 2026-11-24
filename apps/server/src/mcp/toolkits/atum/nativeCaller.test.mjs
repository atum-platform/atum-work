import * as NodeTest from "node:test";
import * as NodeAssert from "node:assert/strict";
import * as NodeFSP from "node:fs/promises";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeHttp from "node:http";
import { bindNativeThread, nativeThreadGrant } from "./forwardAdmission.ts";
import { provisionNativeCaller } from "./nativeCaller.ts";
import { readGrant } from "./boundRegistry.ts";

NodeTest.test(
  "native session producer registers and persists exact caller over private HTTP",
  async () => {
    const dir = await NodeFSP.mkdtemp(NodePath.join(NodeOS.tmpdir(), "native-caller-"));
    const forward = NodePath.join(dir, "forward.json"),
      reverse = NodePath.join(dir, "reverse.json");
    const grant = {
      clientId: "client",
      hermesSessionId: "hermes",
      binding: { owner: "owner", agent: "agent", generation: "1", mac: "mac", consent_revision: 1 },
      actor: "owner",
      audience: "owner_dm",
      expiresAt: 9999999999999,
      enabled: true,
    };
    let received;
    const server = NodeHttp.createServer(async (request, response) => {
      NodeAssert.equal(request.url, "/native-register");
      NodeAssert.equal(request.headers.authorization, "Bearer decoy");
      let body = "";
      for await (const part of request) body += part;
      received = JSON.parse(body);
      response.writeHead(200, { "content-type": "application/json" });
      response.end('{"registered":true}');
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      await NodeFSP.writeFile(forward, JSON.stringify([grant]), { mode: 0o600 });
      await bindNativeThread(forward, "thread", grant);
      const caller = {
        threadId: "thread",
        providerSessionId: "native-session",
        providerInstanceId: "mock",
      };
      await provisionNativeCaller({
        forwardPath: forward,
        grantsPath: reverse,
        endpoint: `http://127.0.0.1:${server.address().port}/ask`,
        token: "decoy",
        caller,
      });
      NodeAssert.deepEqual(received.caller, caller);
      NodeAssert.equal(received.hermesSessionId, "hermes");
      NodeAssert.deepEqual((await readGrant(reverse, caller, 1)).binding, grant.binding);
      await NodeFSP.writeFile(forward, JSON.stringify([{ ...grant, enabled: false }]));
      await NodeAssert.rejects(nativeThreadGrant(forward, "thread"));
    } finally {
      await new Promise((resolve) => server.close(resolve));
      await NodeFSP.rm(dir, { recursive: true, force: true });
    }
  },
);
