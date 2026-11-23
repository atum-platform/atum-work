import * as Effect from "effect/Effect";
import * as Jwt from "effect/jose/Jwt";
import * as Jwks from "effect/jose/Jwks";
import * as Schema from "effect/Schema";

export interface AtumAssertionPolicy {
  readonly issuer: string;
  readonly audience: string;
  readonly jwks: Jwks.KeySet;
}

const Claims = Schema.Struct({
  sub: Schema.String,
  iat: Schema.Number,
  exp: Schema.Number,
});
const ownerId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

// Trust only operator-pinned public JWKS; never a URL or key supplied by a token.
export const verifyAtumAssertion = Effect.fn("relay.auth.verify_atum_assertion")(function* (
  policy: AtumAssertionPolicy,
  token: string,
  expectedOwner?: string,
) {
  const verified = yield* Jwt.verifyWithKeySet(Claims, token, {
    algorithms: ["EdDSA"],
    typ: "atum-relay-assertion+jwt",
    issuer: policy.issuer,
    audience: policy.audience,
    maxTokenAge: "60 seconds",
    clockTolerance: 0,
    requiredClaims: ["sub", "iat", "exp"],
    ...(expectedOwner === undefined ? {} : { subject: expectedOwner }),
  }).pipe(Effect.provide(Jwks.layerLocal(policy.jwks)));
  const claims = verified.claims;
  if (!ownerId.test(claims.sub) || claims.exp <= claims.iat || claims.exp - claims.iat > 60) {
    return yield* Effect.fail(new Error("invalid_atum_owner_assertion"));
  }
  return { sub: claims.sub, mode: "atum_assertion" as const };
});
