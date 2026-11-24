import * as NodeTest from 'node:test';
import * as NodeAssert from 'node:assert/strict';
import * as NodeFSP from 'node:fs/promises';
import * as NodeOS from 'node:os';
import * as NodePath from 'node:path';
import { boundRegistry, readGrant } from './boundRegistry.ts';

NodeTest.test('native caller binding, owner-only audience, live revoke and restart', async () => {
  const dir = await NodeFSP.mkdtemp(NodePath.join(NodeOS.tmpdir(), 'atum-t2-'));
  const file = NodePath.join(dir, 'grants.json');
  const caller = { threadId: 'thread', providerSessionId: 'session', providerInstanceId: 'mock' };
  const grant = { ...caller, binding: { owner: 'o', agent: 'a', generation: 'g', mac: 'm', consent_revision: 1 },
    actor: 'o', audience: 'owner_dm', expiresAt: 1000 + 60_000, enabled: true };
  const save = (g) => NodeFSP.writeFile(file, JSON.stringify([g]));
  try {
    await save(grant);
    let calls = 0;
    const input = { caller, request: { operation: 'list' }, grantsFile: file,
      endpoint: 'http://127.0.0.1:1234/ask', token: 'decoy', current: async () => true, now: async () => 1000,
      fetch: async (_, init) => {
        calls++;
        NodeAssert.deepEqual(JSON.parse(init.body).binding, grant.binding);
        return Response.json({ tools: ['memory'] });
      } };
    NodeAssert.deepEqual(await boundRegistry(input), { tools: ['memory'] });
    // Fresh module/process reads the same file; no in-memory grant authority.
    NodeAssert.deepEqual((await readGrant(file, caller, 1000)).binding, grant.binding);
    await NodeAssert.rejects(readGrant(file, { ...caller, providerSessionId: 'old' }, 1000));
    for (const mutation of [{ actor: 'foreign' }, { audience: 'group' }, { enabled: false }, { expiresAt: 0 }]) {
      await save({ ...grant, ...mutation });
      await NodeAssert.rejects(boundRegistry(input));
    }
    NodeAssert.equal(calls, 1);
    await save(grant);
    await NodeAssert.rejects(boundRegistry({ ...input, fetch: async () => {
      await save({ ...grant, enabled: false });
      return Response.json({ private: 'late result' });
    } }));
    await save({ ...grant, binding: { ...grant.binding, generation: 'new', consent_revision: 2 } });
    NodeAssert.equal((await readGrant(file, caller, 1000)).binding.consent_revision, 2);
  } finally { await NodeFSP.rm(dir, { recursive: true, force: true }); }
});
