// Native T3 control-plane + installed native Mac server. Cloudflare APIs are replaced only
// at the managed-endpoint boundary by a disposable TLS loopback tunnel; no cloud calls.
import assert from "node:assert/strict";
import { atumConnectIdentity } from "../../../apps/web/src/atum/connectIdentity.ts";
import { spawn, execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer as httpServer, request as httpRequest } from "node:http";
import { createServer as httpsServer, request as httpsRequest } from "node:https";
import { generateKeyPairSync, sign, randomUUID, createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as HttpApi from "effect/http-api/HttpApi";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpServer from "effect/http/HttpServer";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { RelayApi } from "@t3tools/contracts/relay";
import * as Config from "../src/Config.ts";
import * as Api from "../src/http/Api.ts";
import * as RelayTokens from "../src/auth/RelayTokens.ts";
import * as Signer from "../src/auth/CloudMintSigner.ts";
import * as Dpop from "../src/auth/DpopProofs.ts";
import * as Linker from "../src/environments/EnvironmentLinker.ts";
import * as Links from "../src/environments/EnvironmentLinks.ts";
import * as Credentials from "../src/environments/EnvironmentCredentials.ts";
import * as Endpoints from "../src/environments/ManagedEndpointProvider.ts";
import * as Limits from "../src/environments/ManagedTunnelLimits.ts";
import * as Devices from "../src/agentActivity/Devices.ts";
import * as T3Chat from "../src/t3chat/T3ChatAccounts.ts";
import * as Db from "../src/db.ts";
const root = await mkdtemp("/private/tmp/atum-connect-proof-");
const owner = "46400000-0000-4000-8000-000000000001";
const exe =
  process.env.ATUM_T3_EXECUTABLE ??
  "/Applications/T3 Code (Beta).app/Contents/MacOS/T3 Code (Beta)";
const bin =
  process.env.ATUM_T3_SERVER ??
  "/Applications/T3 Code (Beta).app/Contents/Resources/app.asar/apps/server/dist/bin.mjs";
const guard = fileURLToPath(new URL("./credential-guard.cjs", import.meta.url));
const close = (s) =>
  new Promise((resolve, reject) => {
    s.close((e) => (e ? reject(e) : resolve()));
    s.closeAllConnections?.();
  });
const listen = (s, port = 0) =>
  new Promise((resolve, reject) => {
    s.once("error", reject);
    s.listen(port, "127.0.0.1", () => resolve(s.address().port));
  });
const json = (url, body, headers = {}) =>
  fetch(url, {
    ...(body === undefined ? {} : { method: "POST", body: JSON.stringify(body) }),
    headers: { "content-type": "application/json", ...headers },
  });
const checked = async (r) => {
  const t = await r.text();
  assert.ok(r.ok, `${r.status} ${t}`);
  return t ? JSON.parse(t) : null;
};
const encode = (x) => Buffer.from(JSON.stringify(x)).toString("base64url");
let mac, relay, tunnel, web;
let log = "";
try {
  await mkdir(root + "/codex");
  await mkdir(root + "/claude");
  const reserve = httpServer();
  const port = await listen(reserve);
  await close(reserve);
  const local = `http://127.0.0.1:${port}`;
  mac = spawn(exe, [bin, "--bootstrap-fd", "3"], {
    env: {
      ...process.env,
      T3CODE_TELEMETRY_ENABLED: "false",
      T3CODE_OTEL_SDK_DISABLED: "true",
      ELECTRON_RUN_AS_NODE: "1",
      NODE_OPTIONS: `--require=${guard}`,
      CODEX_HOME: root + "/codex",
      CLAUDE_CONFIG_DIR: root + "/claude",
    },
    stdio: ["ignore", "pipe", "pipe", "pipe"],
  });
  mac.stdout.on("data", (x) => (log += x));
  mac.stderr.on("data", (x) => (log += x));
  mac.stdio[3].end(
    JSON.stringify({
      mode: "desktop",
      noBrowser: true,
      port,
      t3Home: root,
      host: "127.0.0.1",
      desktopBootstrapToken: "synthetic-loopback-bootstrap-token",
      shellEnvironmentPrepared: true,
      tailscaleServeEnabled: false,
      tailscaleServePort: 443,
    }) + "\n",
  );
  let descriptor;
  for (let i = 0; i < 90; i++) {
    if (mac.exitCode !== null) throw Error(`Mac exited ${mac.exitCode}: ${log}`);
    try {
      const r = await fetch(local + "/.well-known/t3/environment");
      if (r.ok) {
        descriptor = await r.json();
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  assert.ok(descriptor, "Mac startup timeout");
  const session = await json(local + "/api/auth/browser-session", {
    credential: "synthetic-loopback-bootstrap-token",
  });
  await checked(session);
  const cookie = session.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie, "bootstrap session cookie");
  execFileSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      root + "/key.pem",
      "-out",
      root + "/cert.pem",
      "-days",
      "1",
      "-subj",
      "/CN=localhost",
    ],
    { stdio: "ignore" },
  );
  const tls = { key: await readFile(root + "/key.pem"), cert: await readFile(root + "/cert.pem") };
  const makeTunnel = () =>
    httpsServer(tls, (req, res) => {
      const upstream = httpRequest(
        local + req.url,
        { method: req.method, headers: { ...req.headers, "x-forwarded-proto": "https" } },
        (r) => {
          res.writeHead(r.statusCode, r.headers);
          r.pipe(res);
        },
      );
      upstream.on("error", () => {
        res.writeHead(502);
        res.end();
      });
      req.pipe(upstream);
    });
  tunnel = makeTunnel();
  const tunnelPort = await listen(tunnel);
  const endpoint = `https://localhost:${tunnelPort}`;
  // Only this test helper trusts the generated certificate; production clients use normal TLS.
  const remote = (path, body, headers = {}) =>
    new Promise((resolve, reject) => {
      const request = httpsRequest(
        endpoint + path,
        {
          method: body === undefined ? "GET" : "POST",
          rejectUnauthorized: false,
          headers: { "content-type": "application/json", ...headers },
        },
        (res) => {
          const chunks = [];
          res.on("data", (x) => chunks.push(x));
          res.on("end", () =>
            resolve(
              new Response(Buffer.concat(chunks), { status: res.statusCode, headers: res.headers }),
            ),
          );
        },
      );
      request.on("error", reject);
      request.end(
        body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
      );
    });
  const broker = generateKeyPairSync("ed25519"),
    platform = generateKeyPairSync("ed25519");
  const relayIssuer = "https://relay.test";
  const assertion = (sub = owner, expired = false) => {
    const iat = Math.floor(Date.now() / 1000);
    const unsigned =
      encode({ alg: "EdDSA", typ: "atum-relay-assertion+jwt", kid: "test" }) +
      "." +
      encode({
        iss: "https://platform.test",
        aud: relayIssuer,
        sub,
        iat,
        exp: expired ? iat - 120 : iat + 60,
        jti: randomUUID(),
      });
    return (
      unsigned + "." + sign(null, Buffer.from(unsigned), platform.privateKey).toString("base64url")
    );
  };
  const rows = new Map(),
    nonces = new Set();
  const links = Layer.mock(Links.EnvironmentLinks, {
    getForUser: ({ userId, environmentId }) =>
      Effect.succeed(rows.get(userId + environmentId) ?? null),
    listForUser: ({ userId }) =>
      Effect.succeed([...rows.values()].filter((x) => x.userId === userId)),
    upsert: ({ userId, proof, endpoint }) =>
      Effect.sync(() => {
        rows.set(userId + proof.environmentId, {
          ...proof.descriptor,
          userId,
          environmentId: proof.environmentId,
          environmentPublicKey: proof.environmentPublicKey,
          endpoint,
          notificationsEnabled: false,
          liveActivitiesEnabled: false,
          managedTunnelsEnabled: true,
          linkedAt: new Date().toISOString(),
        });
      }),
  });
  const replay = Layer.mock(Dpop.DpopProofReplay, {
    consume: ({ thumbprint, jti }) =>
      Effect.sync(() => {
        const key = thumbprint + jti;
        if (nonces.has(key)) return false;
        nonces.add(key);
        return true;
      }),
  });
  const provider = Layer.mock(Endpoints.ManagedEndpointProvider, {
    prepareDeprovision: () => Effect.succeed(null),
    deprovision: () => Effect.succeed(true),
    provision: () =>
      Effect.succeed({
        endpoint: {
          httpBaseUrl: endpoint + "/",
          wsBaseUrl: endpoint.replace("https:", "wss:") + "/ws",
          providerKind: "cloudflare_tunnel",
        },
        runtime: { providerKind: "cloudflare_tunnel", connectorToken: "local-fixture-only" },
      }),
  });
  const config = Config.layer({
    relayIssuer,
    atumAssertion: {
      issuer: "https://platform.test",
      audience: relayIssuer,
      jwks: {
        keys: [
          {
            ...platform.publicKey.export({ format: "jwk" }),
            kid: "test",
            alg: "EdDSA",
            use: "sig",
          },
        ],
      },
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
    managedEndpointBaseDomain: "localhost",
    managedEndpointNamespace: "test",
  });
  const base = Layer.mergeAll(
    links,
    replay,
    provider,
    Layer.mock(Credentials.EnvironmentCredentials, {
      create: () => Effect.succeed("local-fixture-environment-credential"),
    }),
    Layer.succeed(Db.RelayTransactions, { withTransaction: (x) => x }),
    Layer.mock(Devices.Devices, {}),
    Layer.mock(T3Chat.T3ChatAccounts, {}),
    Layer.mock(Limits.ManagedTunnelLimits, {}),
  );
  const services = Layer.mergeAll(
    Linker.layer,
    RelayTokens.layer.pipe(Layer.provide(Signer.layer)),
  ).pipe(
    Layer.provideMerge(RelayTokens.layer.pipe(Layer.provide(Signer.layer))),
    Layer.provideMerge(base),
    Layer.provideMerge(config),
    Layer.provideMerge(NodeCrypto.layer),
  );
  web = HttpRouter.toWebHandler(
    HttpApiBuilder.layer(HttpApi.make("RelayApi").add(RelayApi.groups.client)).pipe(
      Layer.provide(Api.layerClientApi),
      Layer.provide(Api.layerClientAuth),
      Layer.provide(services),
      Layer.provide(HttpServer.layerServices),
    ),
    { disableLogger: true },
  );
  relay = httpServer(async (req, res) => {
    try {
      const chunks = [];
      for await (const x of req) chunks.push(x);
      const response = await web.handler(
        new Request("http://127.0.0.1" + req.url, {
          method: req.method,
          headers: req.headers,
          ...(req.method === "GET" ? {} : { body: Buffer.concat(chunks) }),
        }),
      );
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (e) {
      res.writeHead(500);
      res.end(String(e));
    }
  });
  const relayPort = await listen(relay);
  const relayUrl = `http://127.0.0.1:${relayPort}`;
  let bridgeReads = 0;
  globalThis.window = { atumWork: { getConnectAssertion: async () => { bridgeReads++; return assertion(); } } };
  const identity = atumConnectIdentity;
  const auth = { authorization: "Bearer " + await identity.getAssertion() };
  assert.notEqual(await identity.getAssertion(), await identity.getAssertion());
  assert.equal(bridgeReads, 3);
  assert.equal((await json(relayUrl + "/v1/environments", undefined, { authorization: "Bearer " + assertion(owner, true) })).status, 401);
  const features = {
    notificationsEnabled: false,
    liveActivitiesEnabled: false,
    managedTunnelsEnabled: true,
  };
  const challenge = await checked(
    await json(relayUrl + "/v1/client/environment-link-challenges", features, auth),
  );
  const proof = await checked(
    await json(
      local + "/api/connect/link-proof",
      {
        challenge: challenge.challenge,
        relayIssuer,
        endpoint: {
          httpBaseUrl: endpoint + "/",
          wsBaseUrl: endpoint.replace("https:", "wss:") + "/ws",
          providerKind: "cloudflare_tunnel",
        },
        origin: { localHttpHost: "127.0.0.1", localHttpPort: port },
      },
      { cookie },
    ),
  );
  const wrongOwnerLink = await json(relayUrl + "/v1/client/environment-links", { ...features, proof }, { authorization: "Bearer " + assertion("46400000-0000-4000-8000-000000000002") });
  assert.ok(wrongOwnerLink.status >= 400 && wrongOwnerLink.status < 500);
  const registered = await checked(
    await json(relayUrl + "/v1/client/environment-links", { ...features, proof }, auth),
  );
  assert.equal(registered.cloudUserId, owner);
  const listing = await checked(await json(relayUrl + "/v1/environments", undefined, auth));
  assert.equal(listing.environments[0].environmentId, descriptor.environmentId);
  const stranger = await checked(
    await json(relayUrl + "/v1/environments", undefined, {
      authorization: "Bearer " + assertion("46400000-0000-4000-8000-000000000002"),
    }),
  );
  assert.equal(stranger.environments.length, 0);
  assert.equal(
    (await json(relayUrl + "/v1/environments", undefined, { authorization: "Bearer forged" }))
      .status,
    401,
  );
  // Native MCP uses its own OAuth audience: account assertions are never Work credentials.
  assert.equal(
    (
      await remote(
        "/mcp",
        { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
        { authorization: auth.authorization, accept: "application/json, text/event-stream" },
      )
    ).status,
    401,
  );
  const pairing = await checked(await json(local + "/api/auth/pairing-token", {}, { cookie }));
  const callback = "http://localhost:51234/callback";
  const client = await checked(
    await remote("/oauth/mcp/register", {
      client_name: "Atum loopback proof",
      redirect_uris: [callback],
      grant_types: ["authorization_code", "refresh_token"],
      token_endpoint_auth_method: "none",
    }),
  );
  const verifier = "v".repeat(64);
  const authorization = {
    response_type: "code",
    client_id: client.client_id,
    redirect_uri: callback,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
    state: "loopback",
    resource: endpoint + "/mcp",
  };
  const approval = await checked(
    await remote("/oauth/mcp/decision", {
      authorization,
      decision: { _tag: "pairing-code", access: "auto", code: pairing.credential },
    }),
  );
  const token = await checked(
    await remote(
      "/oauth/mcp/token",
      new URLSearchParams({
        grant_type: "authorization_code",
        code: new URL(approval.redirectTo).searchParams.get("code"),
        redirect_uri: callback,
        client_id: client.client_id,
        code_verifier: verifier,
        resource: endpoint + "/mcp",
      }).toString(),
      { "content-type": "application/x-www-form-urlencoded" },
    ),
  );
  const initialize = () =>
    remote(
      "/mcp",
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "atum-loopback", version: "1" },
        },
      },
      {
        authorization: "Bearer " + token.access_token,
        accept: "application/json, text/event-stream",
      },
    );
  const first = await initialize();
  assert.equal(first.status, 200);
  assert.match(await first.text(), /serverInfo/);
  await close(tunnel);
  tunnel = null;
  await assert.rejects(initialize());
  tunnel = makeTunnel();
  await listen(tunnel, tunnelPort);
  const reconnected = await initialize();
  assert.equal(reconnected.status, 200);
  assert.match(await reconnected.text(), /serverInfo/);
  console.log(
    JSON.stringify({
      result: "PASS",
      macVersion: descriptor.serverVersion,
      registered: true,
      fakeDesktopBridgeReads: bridgeReads,
      expiredAssertionDenied: true,
      wrongOwnerRegistrationDenied: true,
      atumWrongOwnerDenied: true,
      invalidIdentityDenied: true,
      mcpOAuth: true,
      reconnectAfterTunnelDrop: true,
    }),
  );
} finally {
  if (tunnel) await close(tunnel);
  if (relay) await close(relay);
  if (web) await web.dispose();
  if (mac) {
    mac.kill("SIGTERM");
    await new Promise((resolve) => {
      if (mac.exitCode !== null) resolve();
      else mac.once("exit", resolve);
    });
  }
  await writeFile(root + "/server.log", log);
  console.log("Disposable evidence:", root); // generated keys only
}
