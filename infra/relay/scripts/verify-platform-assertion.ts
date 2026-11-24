// Offline seam; generated keys only. Companion platform source path is explicit.
import {generateKeyPairSync,createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import * as Effect from 'effect/Effect';
import * as Jwks from 'effect/jose/Jwks';
import * as Schema from 'effect/Schema';
import {verifyAtumAssertion} from '../src/auth/AtumAssertion.ts';
if (!process.argv[2]) throw new Error('Pass platform checkout path');
const {connectAssertionSigner}=await import(pathToFileURL(resolve(process.argv[2],'apps/shell/src/lib/atum-connect-assertion.ts')).href);
const pair=generateKeyPairSync('ed25519');
const signer=connectAssertionSigner({
 ATUM_CONNECT_ASSERTION_PRIVATE_KEY:pair.privateKey.export({format:'jwk'}).d!,
 ATUM_CONNECT_ASSERTION_KEY_ID:createHash('sha256').update(pair.publicKey.export({format:'der',type:'spki'})).digest('base64url'),
 ATUM_CONNECT_ASSERTION_ISSUER:'https://api.atumplatform.com',
 ATUM_CONNECT_ASSERTION_AUDIENCE:'https://relay.atumplatform.com',
});
const policy={issuer:'https://api.atumplatform.com',audience:'https://relay.atumplatform.com',jwks:Schema.decodeUnknownSync(Jwks.KeySet)(signer.jwks)};
const owner='42000000-0000-4000-8000-000000000001';
await Effect.runPromise(verifyAtumAssertion(policy,signer.mint(owner).assertion,owner));
for(const [p,token] of [[{...policy,audience:'https://evil.test'},signer.mint(owner).assertion],
 [policy,signer.mint(owner,Math.floor(Date.now()/1000)-61).assertion]] as const){
 await Effect.runPromise(verifyAtumAssertion(p,token).pipe(Effect.flip));
}
console.log('PLATFORM_RELAY_SEAM_OK valid bytes accepted; wrong audience and expired assertion refused');
