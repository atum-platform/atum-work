import * as Redacted from 'effect/Redacted';
import type { Origin } from '@alchemy.run/cloudflare/Hyperdrive/Connection';

/** Native Hyperdrive origin; never fall back to a paid database vendor. */
export function externalPostgresOrigin(connectionString: string, serviceId = ''): Origin {
  try {
    const url = new URL(connectionString);
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.pathname !== '/atum_connect'
      || decodeURIComponent(url.username) !== 'atum_connect' || !url.password || url.hash
      || (url.searchParams.get('sslmode') !== 'require' && url.searchParams.get('sslmode') !== 'verify-full')) throw new Error();
    const common = {scheme:'postgres' as const, database:'atum_connect',user:'atum_connect',
      password:Redacted.make(decodeURIComponent(url.password))};
    if (serviceId) return {...common,serviceId};
    return {...common,host:url.hostname,port:Number(url.port || 5432)};
  } catch { throw new Error('Invalid isolated relay Postgres origin (require TLS, atum_connect database/role)'); }
}
