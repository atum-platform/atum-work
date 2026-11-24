import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { boundRegistry, readGrant } from './boundRegistry.ts';

test('native caller binding, owner-only audience, live revoke and restart', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'atum-t2-'));
  const file = join(dir, 'grants.json');
  const caller = { threadId: 'thread', providerSessionId: 'session', providerInstanceId: 'mock' };
  const grant = { ...caller, binding: { owner: 'o', agent: 'a', generation: 'g', mac: 'm', consent_revision: 1 },
    actor: 'o', audience: 'owner_dm', expiresAt: Date.now() + 60_000, enabled: true };
  const save = (g) => writeFile(file, JSON.stringify([g]));
  try {
    await save(grant);
    let calls = 0;
    const input = { caller, request: { operation: 'list' }, grantsFile: file,
      endpoint: 'http://127.0.0.1:1234/ask', token: 'decoy', current: async () => true, now: async () => Date.now(),
      fetch: async (_, init) => {
        calls++;
        assert.deepEqual(JSON.parse(init.body).binding, grant.binding);
        return Response.json({ tools: ['memory'] });
      } };
    assert.deepEqual(await boundRegistry(input), { tools: ['memory'] });
    // Fresh module/process reads the same file; no in-memory grant authority.
    assert.deepEqual((await readGrant(file, caller, Date.now())).binding, grant.binding);
    await assert.rejects(readGrant(file, { ...caller, providerSessionId: 'old' }, Date.now()));
    for (const mutation of [{ actor: 'foreign' }, { audience: 'group' }, { enabled: false }, { expiresAt: 0 }]) {
      await save({ ...grant, ...mutation });
      await assert.rejects(boundRegistry(input));
    }
    assert.equal(calls, 1);
    await save(grant);
    await assert.rejects(boundRegistry({ ...input, fetch: async () => {
      await save({ ...grant, enabled: false });
      return Response.json({ private: 'late result' });
    } }));
    await save({ ...grant, binding: { ...grant.binding, generation: 'new', consent_revision: 2 } });
    assert.equal((await readGrant(file, caller, Date.now())).binding.consent_revision, 2);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
