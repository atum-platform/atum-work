import * as NodeTest from "node:test";
import * as NodeAssert from "node:assert/strict";
import * as NodeFSP from "node:fs/promises";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import { forwardGrant, bindForwardToken, admitForwardToken } from "./forwardAdmission.ts";

NodeTest.test(
  "forward OAuth and dispatch bind exact K2; revoke and renewal invalidate old tokens",
  async () => {
    const dir = await NodeFSP.mkdtemp(NodePath.join(NodeOS.tmpdir(), "atum-forward-"));
    const file = NodePath.join(dir, "consent.json");
    const g = {
      clientId: "oauth-client",
      binding: { owner: "o", agent: "a", generation: "1", mac: "m", consent_revision: 1 },
      actor: "o",
      audience: "owner_dm",
      expiresAt: 9999999999999,
      enabled: true,
    };
    const save = async (rows) => {
      await NodeFSP.writeFile(file, JSON.stringify(rows), { mode: 0o600 });
    };
    try {
      await save([g]);
      await bindForwardToken(file, "decoy-token", g.clientId);
      NodeAssert.deepEqual(await admitForwardToken(file, "decoy-token"), g);
      await NodeAssert.rejects(admitForwardToken(file, "foreign-token"));
      await save([{ ...g, expiresAt: g.expiresAt + 1000 }]);
      NodeAssert.equal((await admitForwardToken(file, "decoy-token")).binding.consent_revision, 1);
      for (const change of [
        { actor: "foreign" },
        { audience: "group" },
        { enabled: false },
        { expiresAt: 0 },
      ]) {
        await save([{ ...g, ...change }]);
        await NodeAssert.rejects(forwardGrant(file, g.clientId));
        await NodeAssert.rejects(admitForwardToken(file, "decoy-token"));
      }
      await save([{ ...g, binding: { ...g.binding, consent_revision: 2 } }]);
      await NodeAssert.rejects(admitForwardToken(file, "decoy-token"));
      await bindForwardToken(file, "reapproved-token", g.clientId);
      NodeAssert.equal(
        (await admitForwardToken(file, "reapproved-token")).binding.consent_revision,
        2,
      );
      await save([g, g]);
      await NodeAssert.rejects(forwardGrant(file, g.clientId));
      await save([g]);
      await NodeFSP.chmod(file, 0o644);
      await NodeAssert.rejects(forwardGrant(file, g.clientId));
    } finally {
      await NodeFSP.rm(dir, { recursive: true, force: true });
    }
  },
);
