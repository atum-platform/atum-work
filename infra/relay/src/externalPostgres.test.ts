import {expect,it} from '@effect/vitest';
import {externalPostgresOrigin} from './externalPostgres.ts';
it('uses isolated origin and native private VPC without exposing passwords',()=>{
 const origin=externalPostgresOrigin('postgres://atum_connect:synthetic@private/atum_connect?sslmode=require','vpc-service');
 expect(origin).toMatchObject({serviceId:'vpc-service',database:'atum_connect',user:'atum_connect'});
 expect(JSON.stringify(origin)).not.toContain('synthetic');
});
it('refuses production databases, wrong roles and plaintext origins',()=>{
 for(const url of ['postgres://atum_connect:p@db/marketplace?sslmode=require','postgres://marketplace:p@db/atum_connect?sslmode=require','postgres://atum_connect:p@db/atum_connect']) expect(()=>externalPostgresOrigin(url)).toThrow();
});
