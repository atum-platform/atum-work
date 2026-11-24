import test from 'node:test';
import assert from 'node:assert/strict';
import {createAtumConnectIdentity, managedEnvironmentMcpUrl} from '../../../packages/client-runtime/src/relay/atumIdentity.ts';

test('desktop identity asks the bridge on every use and rejects missing assertions', async () => {
  let reads = 0;
  const identity = createAtumConnectIdentity({getAssertion: async () => `assertion-${++reads}`});
  assert.equal(await identity.getAssertion(), 'assertion-1');
  assert.equal(await identity.getAssertion(), 'assertion-2');
  await assert.rejects(createAtumConnectIdentity({getAssertion: async () => ''}).getAssertion());
});

test('Atum adapter uses the platform assertion endpoint without exposing owner parameters', async () => {
  const identity = createAtumConnectIdentity('https://platform.test', {
    ownerId: () => 'owner', getPlatformBearer: async () => 'synthetic',
  }, async (url, init) => {
    assert.equal(url.href, 'https://platform.test/api/work/connect/assertion');
    assert.equal(init.headers.authorization, 'Bearer synthetic');
    assert.equal(init.redirect, 'error');
    return Response.json({assertion: 'signed-by-platform'});
  });
  assert.equal(await identity.getAssertion(), 'signed-by-platform');
});
test('account switch discards an in-flight assertion', async () => {
  let owner = 'a';
  const identity = createAtumConnectIdentity('https://platform.test', {
    ownerId: () => owner, getPlatformBearer: async () => 'synthetic',
  }, async () => { owner = 'b'; return Response.json({assertion: 'old'}); });
  await assert.rejects(identity.getAssertion(), /account changed/);
});
test('bridge seam rejects credentials and uses managed environment /mcp', () => {
  assert.equal(managedEnvironmentMcpUrl('https://mac.connect.test/'), 'https://mac.connect.test/mcp');
  for (const url of ['http://mac.test','https://user:pass@mac.test','https://mac.test/?token=secret','https://mac.test/api']) {
    assert.throws(() => managedEnvironmentMcpUrl(url));
  }
});
