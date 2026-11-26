import { expect, it } from "@effect/vitest";
import { ThreadId } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Ref from "effect/Ref";

import * as McpProviderSessions from "./McpProviderSessions.ts";
import type { ManagedMcpServer } from "./mcpSession.ts";

it.effect("withholds host account services only while a thread has relay servers", () =>
  Effect.gen(function* () {
    const owner = ThreadId.make("owner-thread");
    const attached = ThreadId.make("relay-thread");
    const google = {
      name: "atum-account-google-fixture",
      url: "http://127.0.0.1:43123/mcp/google",
      omitWhenRelayAttached: true,
    } satisfies ManagedMcpServer;
    const chats = {
      name: "atum-account-owner-chats-fixture",
      url: "http://127.0.0.1:43123/mcp/owner-chats",
      omitWhenRelayAttached: true,
    } satisfies ManagedMcpServer;
    const host = { name: "host-fixture", url: "http://127.0.0.1:43123/mcp/host" };
    const relay = { name: "relay", url: "http://127.0.0.1:43124/attachment" };
    const attachment = yield* Ref.make<ReadonlyArray<ManagedMcpServer>>([relay]);
    const hostServers = [google, chats, host];
    const layer = McpProviderSessions.layerWithManagedServers(
      Effect.succeed(hostServers),
      (thread) => (thread === attached ? Ref.get(attachment) : Effect.succeed([])),
    );

    yield* Effect.gen(function* () {
      const sessions = yield* McpProviderSessions.McpProviderSessions;
      expect(yield* sessions.readManagedServersForThread(attached)).toEqual([host, relay]);
      expect(yield* sessions.readManagedServersForThread(owner)).toEqual(hostServers);
      expect(yield* sessions.readManagedServersForThread(null)).toEqual(hostServers);

      yield* Ref.set(attachment, []);
      expect(yield* sessions.readManagedServersForThread(attached)).toEqual(hostServers);
    }).pipe(Effect.provide(layer));
  }),
);
