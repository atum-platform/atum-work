import * as Cause from 'effect/Cause';
import * as Effect from 'effect/Effect';

/** Closed diagnostics: never serialize exceptions, SQL, URLs, headers, or credentials. */
export function safeFailure(value: unknown, depth = 0): {tag: string; message: string; code?: string} {
  const error = value !== null && typeof value === 'object' ? value as Record<string, unknown> : {};
  const message = typeof value === 'string' ? value : typeof error.message === 'string' ? error.message : '';
  const group = /^HttpApiGroup "([a-zA-Z]+)" not found/.exec(message)?.[1];
  if (group && ['health','metadata','mobile','client','token','dpopClient','server','hooks','mobileTelemetry'].includes(group)) {
    return {tag:'MissingHttpApiGroup', message:`HTTP API group ${group} has no handler`};
  }
  if (message.startsWith('Service not found:')) return {tag:'MissingService',message:'Required Effect service is missing'};
  const code = typeof error.code === 'string' && ['ECONNREFUSED','ETIMEDOUT','ENOTFOUND','ERR_TLS_CERT_ALTNAME_INVALID','CERT_HAS_EXPIRED','SELF_SIGNED_CERT_IN_CHAIN','28P01','3D000','42501'].includes(error.code) ? error.code : undefined;
  const nestedCode = depth < 4 && error.cause !== undefined ? safeFailure(error.cause, depth + 1).code : undefined;
  const tag = typeof error._tag === 'string' && ['ConfigError','SqlError','SqlConnectionError','RequestError','ResponseError','SchemaError'].includes(error._tag) ? error._tag : 'UnhandledFailure';
  return {tag,message:code || nestedCode ? 'Dependency connection or authorization failed' : 'Handler failed; private error details omitted',...((code || nestedCode) ? {code:code || nestedCode} : {})};
}
export const logHttpFailure = (phase: string) => (cause: Cause.Cause<unknown>) => {
  const failures = cause.reasons.filter(reason => reason._tag !== 'Interrupt').map(reason =>
    safeFailure(reason._tag === 'Fail' ? reason.error : reason._tag === 'Die' ? reason.defect : undefined));
  return failures.length ? Effect.logError('Relay HTTP failure', JSON.stringify({phase,failures})) : Effect.void;
};
