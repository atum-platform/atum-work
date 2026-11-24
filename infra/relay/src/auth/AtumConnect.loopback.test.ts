// @effect-diagnostics nodeBuiltinImport:off -- Generated keys and an ephemeral HTTP listener.
import { createServer } from "node:http";
import { generateKeyPairSync, sign, randomUUID } from "node:crypto";
import { expect, it } from "@effect/vitest";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Jwks from "effect/jose/Jwks";
import * as Schema from "effect/Schema";
import * as Redacted from "effect/Redacted";
import * as HttpApi from "effect/http-api/HttpApi";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpServer from "effect/http/HttpServer";
import { RelayApi } from "@t3tools/contracts/relay";
import * as Configuration from "../Config.ts";
import * as Api from "../http/Api.ts";
import * as CloudMintSigner from "./CloudMintSigner.ts";
import * as RelayTokens from "./RelayTokens.ts";
import * as Dpop from "./DpopProofs.ts";
import * as Db from "../db.ts";

it.effect("native HTTP token exchange enforces Atum identity and DPoP replay", () =>
  Effect.gen(function* () {
    const platform = generateKeyPairSync("ed25519");
    const broker = generateKeyPairSync("ed25519");
    const device = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const owner = "46400000-0000-4000-8000-000000000001";
    const issuer = "https://platform.test";
    const audience = "http://127.0.0.1";
    const encode = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
    const assertion = (patch: Record<string, unknown> = {}) => {
      const now = Math.floor(Date.now() / 1000);
      const input = `${encode({ alg: "EdDSA", typ: "atum-relay-assertion+jwt", kid: "test" })}.${encode({ iss: issuer, aud: audience, sub: owner, iat: now, exp: now + 60, jti: randomUUID(), ...patch })}`;
      return `${input}.${sign(null, Buffer.from(input), platform.privateKey).toString("base64url")}`;
    };
    let proofTarget = "";
    const proof = () => {
      const input = `${encode({ typ: "dpop+jwt", alg: "ES256", jwk: device.publicKey.export({ format: "jwk" }) })}.${encode({ htm: "POST", htu: proofTarget, jti: randomUUID(), iat: Math.floor(Date.now() / 1000) })}`;
      return `${input}.${sign("sha256", Buffer.from(input), { key: device.privateKey, dsaEncoding: "ieee-p1363" }).toString("base64url")}`;
    };
    const consumed = new Set<string>();
    const db = {
      insert: () => ({
        values: (v: { thumbprint: string; jti: string }) => ({
          onConflictDoNothing: () => ({
            returning: () =>
              Effect.sync(() => {
                const key = `${v.thumbprint}:${v.jti}`;
                if (consumed.has(key)) return [];
                consumed.add(key);
                return [{ jti: v.jti }];
              }),
          }),
        }),
      }),
    } as unknown as Db.RelayDb["Service"];
    const config = Configuration.layer({
      relayIssuer: audience,
      atumAssertion: {
        issuer,
        audience,
        jwks: Schema.decodeUnknownSync(Jwks.KeySet)({
          keys: [
            {
              ...platform.publicKey.export({ format: "jwk" }),
              kid: "test",
              alg: "EdDSA",
              use: "sig",
            },
          ],
        }),
      },
      apns: null,
      clerkSecretKey: Redacted.make(""),
      clerkPublishableKey: "",
      clerkJwtAudience: "",
      apnsDeliveryJobSigningSecret: Redacted.make("fixture"),
      cloudMintPrivateKey: Redacted.make(
        broker.privateKey.export({ format: "pem", type: "pkcs8" }).toString(),
      ),
      cloudMintPublicKey: broker.publicKey.export({ format: "pem", type: "spki" }).toString(),
      managedEndpointBaseDomain: undefined,
      managedEndpointNamespace: undefined,
    });
    const services = Layer.mergeAll(
      RelayTokens.layer.pipe(Layer.provide(CloudMintSigner.layer)),
      Dpop.layer.pipe(Layer.provide(Layer.succeed(Db.RelayDb, db))),
    ).pipe(Layer.provideMerge(config), Layer.provideMerge(NodeCrypto.layer));
    const app = HttpRouter.toWebHandler(
      HttpApiBuilder.layer(HttpApi.make("RelayApi").add(RelayApi.groups.token)).pipe(
        Layer.provide(Api.layerTokenApi),
        Layer.provide(services),
        Layer.provide(HttpServer.layerServices),
      ),
      { disableLogger: true },
    );
    yield* Effect.addFinalizer(() => Effect.promise(() => app.dispose()));
    const server = createServer(async (req, res) => {
      try {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const response = await app.handler(
          new Request(`${audience}${req.url}`, {
            method: req.method ?? "POST",
            headers: req.headers as Record<string, string>,
            body: Buffer.concat(chunks),
          }),
        );
        res.writeHead(response.status, Object.fromEntries(response.headers));
        res.end(Buffer.from(await response.arrayBuffer()));
      } catch {
        res.writeHead(500);
        res.end();
      }
    });
    yield* Effect.acquireRelease(
      Effect.promise(() => new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))),
      () =>
        Effect.promise(
          () =>
            new Promise<void>((resolve, reject) =>
              server.close((e) => (e ? reject(e) : resolve())),
            ),
        ),
    );
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("missing address");
    const endpoint = `${audience}:${address.port}/v1/client/dpop-token`;
    proofTarget = endpoint;
    const send = (token: string, dpop = proof()) =>
      fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", dpop },
        body: new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
          subject_token: token,
          subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
          requested_token_type: "urn:ietf:params:oauth:token-type:access_token",
          resource: audience,
          scope: "environment:connect",
          client_id: "t3-web",
        }),
      });
    const dpop = proof();
    const accepted = yield* Effect.promise(() => send(assertion(), dpop));
    expect(accepted.status).toBe(200);
    const result = yield* Effect.promise(() =>
      accepted
        .json()
        .then(
          Schema.decodeUnknownSync(
            Schema.Struct({ access_token: Schema.String, token_type: Schema.String }),
          ),
        ),
    );
    expect(result.token_type).toBe("DPoP");
    const tokens = yield* RelayTokens.RelayTokens.pipe(Effect.provide(services));
    const claims = yield* Effect.promise(() =>
      Effect.runPromise(tokens.verifyDpopAccessToken({ token: result.access_token })),
    );
    expect(claims?.sub).toBe(owner);
    expect(claims?.cnf.jkt).toBeTruthy();
    const replay = yield* Effect.promise(() => send(assertion(), dpop));
    expect(replay.status).toBe(401);
    for (const patch of [
      { aud: "https://wrong.test" },
      { sub: "@mutable:matrix.test" },
      { exp: 1 },
    ]) {
      const rejected = yield* Effect.promise(() => send(assertion(patch)));
      expect(rejected.status).toBe(401);
    }
    const clerk = yield* Effect.promise(() => send("clerk-token"));
    expect(clerk.status).toBe(401);
  }).pipe(Effect.scoped),
);
