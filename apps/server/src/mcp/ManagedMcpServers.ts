import * as McpProviderSessions from "@t3tools/provider-core/server/McpProviderSessions";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";

import { ServerConfig } from "../config.ts";

const managedServer = Schema.Struct({
  name: Schema.String.check(Schema.isPattern(/^[a-z0-9_-]+$/)),
  url: Schema.String,
  authorizationHeader: Schema.String.check(Schema.isPattern(/^Bearer [!-~]+$/)),
});
const decodeServers = Schema.decodeUnknownEffect(
  Schema.fromJsonString(Schema.Array(managedServer)),
);

function usableServer(server: typeof managedServer.Type): boolean {
  if (server.name === "t3-code" || server.name === "t3-code-direct") return false;
  const url = URL.parse(server.url);
  return (
    url !== null &&
    !url.username &&
    !url.password &&
    !url.hash &&
    (url.protocol === "https:" || (url.protocol === "http:" && url.hostname === "127.0.0.1"))
  );
}

/** A host app may atomically replace this file. Keep it out of client-visible settings. */
export const layer = Layer.unwrap(
  Effect.gen(function* () {
    const { stateDir } = yield* ServerConfig;
    const fs = yield* FileSystem.FileSystem;
    const path = (yield* Path.Path).join(stateDir, "managed-mcp-servers.json");
    const read = fs.readFileString(path).pipe(
      Effect.flatMap(decodeServers),
      Effect.map((servers) =>
        Array.from(
          new Map(servers.filter(usableServer).map((server) => [server.name, server])).values(),
        ),
      ),
      // Parse errors can contain input, including authorization headers.
      Effect.orElseSucceed(() => []),
    );
    return McpProviderSessions.layerWithManagedServers(read);
  }),
);
