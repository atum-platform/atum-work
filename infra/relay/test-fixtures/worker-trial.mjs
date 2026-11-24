import test from 'node:test';
import assert from 'node:assert/strict';
import * as Layer from 'effect/Layer';
import * as HttpApi from 'effect/http-api/HttpApi';
import * as HttpApiBuilder from 'effect/http-api/HttpApiBuilder';
import * as HttpRouter from 'effect/http/HttpRouter';
import * as HttpServer from 'effect/http/HttpServer';
import {RelayApi} from '../../../packages/contracts/src/relay.ts';
import * as MobileTelemetry from '../src/mobileTelemetry/MobileTelemetry.ts';
import * as Api from '../src/http/Api.ts';
import * as Configuration from '../src/Config.ts';
import {safeFailure} from '../src/http/failureDiagnostics.ts';
test('trial registers disabled telemetry and serves metadata with no DB or Axiom',async()=>{
 const api=HttpApi.make('Trial').add(RelayApi.groups.metadata,RelayApi.groups.mobileTelemetry);
 const routes=HttpApiBuilder.layer(api).pipe(Layer.provide(Layer.merge(Api.layerMetadataApi,MobileTelemetry.layerDisabledApi)),Layer.provide(Configuration.layer({relayIssuer:'https://relay.test'})),Layer.provide(HttpServer.layerServices));
 const {handler,dispose}=HttpRouter.toWebHandler(routes);
 try {
  const metadata=await handler(new Request('https://relay.test/.well-known/oauth-authorization-server'));
  assert.equal(metadata.status,200);assert.equal((await metadata.json()).issuer,'https://relay.test');
  const disabled=await handler(new Request('https://relay.test/v1/mobile/observe/42000000-0000-4000-8000-000000000001/v1/logs',{method:'POST',body:'sensitive telemetry'}));
  assert.equal(disabled.status,404);
 } finally {await dispose();}
});
test('diagnostics preserve missing group and connection code without secret fields',()=>{
 assert.deepEqual(safeFailure('HttpApiGroup "mobileTelemetry" not found (private suffix)'),{tag:'MissingHttpApiGroup',message:'HTTP API group mobileTelemetry has no handler'});
 const secret='postgresql://user:password@private.invalid/db?token=secret';
 const error=Object.assign(new Error(secret),{code:'ERR_TLS_CERT_ALTNAME_INVALID',cause:new Error(secret),token:secret});
 assert.equal(JSON.stringify(safeFailure(error)).includes(secret),false);
 assert.equal(safeFailure(error).code,'ERR_TLS_CERT_ALTNAME_INVALID');
 assert.equal(JSON.stringify(safeFailure({message:secret,_tag:secret})).includes(secret),false);
});
