import * as NodeTest from "node:test";
import * as NodeAssert from "node:assert/strict";
import * as NodeFSP from "node:fs/promises";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeHttp from "node:http";

process.env.ATUM_WORK_MAC_ID = "mac";
const { bindNativeThread, nativeThreadGrant } = await import("./forwardAdmission.ts");
const { callerFile, provisionNativeCaller } = await import("./nativeCaller.ts");

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
      const persisted = JSON.parse(await NodeFSP.readFile(callerFile(reverse, caller), "utf8"));
      NodeAssert.deepEqual(persisted, {
        ...caller,
        binding: grant.binding,
        actor: grant.actor,
        audience: grant.audience,
        expiresAt: grant.expiresAt,
        enabled: grant.enabled,
      });
      await NodeFSP.writeFile(forward, JSON.stringify([{ ...grant, enabled: false }]));
      await NodeAssert.rejects(nativeThreadGrant(forward, "thread"));
    } finally {
      await new Promise((resolve) => server.close(resolve));
      await NodeFSP.rm(dir, { recursive: true, force: true });
    }
  },
);
