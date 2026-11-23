import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {verifyDpopProof,computeDpopJwkThumbprint,computeDpopAccessTokenHash} from '../../../packages/shared/src/dpop.ts';
const url='https://relay.test/v1/environments/env/connect';
const owner=generateKeyPairSync('ec',{namedCurve:'P-256'});
const attacker=generateKeyPairSync('ec',{namedCurve:'P-256'});
const now=100000;
const accessToken='synthetic-dpop-access-token';
const thumbprint=computeDpopJwkThumbprint(owner.publicKey.export({format:'jwk'}));
function proof(pair,token=accessToken) {
 const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
 const text=enc({typ:'dpop+jwt',alg:'ES256',jwk:pair.publicKey.export({format:'jwk'})})+'.'+enc({htm:'POST',htu:url,jti:'fixture-proof',iat:now,ath:computeDpopAccessTokenHash(token)});
 return text+'.'+sign('sha256',Buffer.from(text),{key:pair.privateKey,dsaEncoding:'ieee-p1363'}).toString('base64url');
}
const check=p=>verifyDpopProof({proof:p,method:'POST',url,nowEpochSeconds:now,expectedThumbprint:thumbprint,expectedAccessToken:accessToken});
test('native DPoP accepts only bound key and token',()=>{
 assert.equal(check(proof(owner)).ok,true);
 assert.equal(check(undefined).code,'missing_proof');
 assert.equal(check(proof(attacker)).code,'key_mismatch');
 assert.equal(check(proof(owner,'another-token')).code,'access_token_hash_mismatch');
});
