import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync, sign} from 'node:crypto';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Signature from 'effect/crypto/Signature';
import * as SecureRandom from 'effect/crypto/SecureRandom';
import {verifyAtumAssertion} from '../src/auth/AtumAssertion.ts';
const pair = generateKeyPairSync('ed25519');
const owner = '46400000-0000-4000-8000-000000000001';
const other = '46400000-0000-4000-8000-000000000002';
const policy = {issuer:'https://platform.test',audience:'https://relay.test',jwks:{keys:[{...pair.publicKey.export({format:'jwk'}),kid:'fixture',alg:'EdDSA',use:'sig'}]}};
const layer = Signature.layerWebCrypto.pipe(Layer.provide(SecureRandom.layerWebCrypto));
function token(patch={},key=pair.privateKey) {
 const iat=Math.floor(Date.now()/1000);
 const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
 const text=enc({alg:'EdDSA',typ:'atum-relay-assertion+jwt',kid:'fixture'})+'.'+enc({iss:policy.issuer,aud:policy.audience,sub:owner,iat,exp:iat+60,...patch});
 return text+'.'+sign(null,Buffer.from(text),key).toString('base64url');
}
const verify=(value,expected=owner)=>Effect.runPromise(verifyAtumAssertion(policy,value,expected).pipe(Effect.provide(layer)));
test('signed JWKS assertion resolves canonical owner',async()=>assert.equal((await verify(token())).sub,owner));
for(const [name,patch] of Object.entries({missingExpiry:{exp:undefined},missingIssuedAt:{iat:undefined},owner:{sub:other},audience:{aud:'https://elsewhere.test'},issuer:{iss:'https://evil.test'},expiry:{exp:1},longLifetime:{exp:Math.floor(Date.now()/1000)+3600},mutableHandle:{sub:'@owner:matrix.test'}})) {
 test(`rejects wrong ${name}`,async()=>assert.rejects(verify(token(patch))));
}
test('rejects a signature from a stolen assertion with an unrelated key',async()=>assert.rejects(verify(token({},generateKeyPairSync('ed25519').privateKey))));
