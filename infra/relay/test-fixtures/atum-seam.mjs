import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Signature from 'effect/crypto/Signature';
import * as SecureRandom from 'effect/crypto/SecureRandom';
import {verifyAtumAssertion} from '../src/auth/AtumAssertion.ts';
import {connectAssertionEndpoint, connectAssertionJwks} from '../../../../atum-platform/apps/shell/src/lib/connect-assertion.ts';
import {atumConnectAdapter} from '../../../../atum-desktop/apps/desktop/electron/work/connect.ts';

test('real platform signing bytes cross desktop adapter and relay verifier',async()=>{
 const owner='46400000-0000-4000-8000-000000000001';
 const key=generateKeyPairSync('ed25519').privateKey.export({format:'pem',type:'pkcs8'});
 const endpoint=connectAssertionEndpoint({enabled:true,issuer:'https://platform.test',relayAudience:'https://relay.test',keyId:'fixture',privateKeyPem:key},async()=>owner);
 const adapter=atumConnectAdapter({enabled:true,relayUrl:'https://relay.test',platformUrl:'https://platform.test'},{owner:()=>owner,bearer:async()=>'synthetic',fetch:async(url,init)=>endpoint(new Request(url,init))});
 const token=await adapter.getAssertion();
 const verified=await Effect.runPromise(verifyAtumAssertion({issuer:'https://platform.test',audience:adapter.relayUrl,jwks:connectAssertionJwks(key,'fixture')},token,owner).pipe(Effect.provide(Signature.layerWebCrypto.pipe(Layer.provide(SecureRandom.layerWebCrypto)))));
 assert.equal(verified.sub,owner);
});
