import * as NodeFSP from "node:fs/promises";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import { ProviderInstanceId } from "@t3tools/contracts";
import {
  AcpRegistryCatalog,
  AcpRegistryError,
} from "@t3tools/provider-acp-registry/server/AcpRegistrySupport";
import * as IdAllocator from "@t3tools/provider-core/server/IdAllocator";
import * as McpProviderSessions from "@t3tools/provider-core/server/McpProviderSessions";
import * as ProviderEventLoggers from "@t3tools/provider-core/server/ProviderEventLoggers";
import { ProviderHost } from "@t3tools/provider-core/server/ProviderHost";
import * as TestProviderHost from "@t3tools/provider-testing/TestProviderHost";
import * as HostProcess from "@t3tools/shared/HostProcess";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as Stream from "effect/Stream";
import { vi } from "vite-plus/test";

import { AtumKiroDriver } from "./AtumKiroDriver.ts";

vi.mock("node:fs/promises", { spy: true });

const hostLayer = TestProviderHost.layer({ runBackgroundWork: false }).pipe(
  Layer.provideMerge(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer)),
  Layer.provideMerge(IdAllocator.layer),
  Layer.provideMerge(McpProviderSessions.layer),
  Layer.provideMerge(
    Layer.succeed(
      ProviderEventLoggers.ProviderEventLoggers,
      ProviderEventLoggers.NoOpProviderEventLoggers,
    ),
  ),
);

it.layer(hostLayer, { excludeTestServices: true })("Kiro Free setup", (it) => {
  it.effect.each(["google", "github"])(
    "replaces a stale link and signs in with %s on closed stdin",
    (method) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const { paths } = yield* ProviderHost;
        const command = path.join(paths.baseDir, "kiro-cli");
        const record = path.join(paths.baseDir, "login-method");
        const directory = path.join(paths.baseDir, "tools", "kiro-free");
        const link = path.join(directory, "kiro-cli");
        yield* fs.makeDirectory(directory, { recursive: true });
        yield* fs.symlink(path.join(directory, "missing-kiro"), link);
        yield* fs.writeFileString(
          command,
          [
            "#!/bin/sh",
            'case "$1" in',
            "  login)",
            '    [ "$#" = 3 ] && [ "$2" = "--social" ] && [ ! -t 0 ] || exit 1',
            "    if read -r unexpected; then exit 1; fi",
            '    printf "%s" "$3" > "$KIRO_TEST_RECORD";;',
            '  --version) echo "kiro-cli 3.6.2";;',
            "  whoami) echo '{\"account\":null}'; exit 1;;",
            "  *) exit 1;;",
            "esac",
          ].join("\n"),
          { mode: 0o700 },
        );

        const unused = () => Effect.die("Unexpected catalog operation");
        const provider = yield* AtumKiroDriver.create({
          instanceId: ProviderInstanceId.make("kiro"),
          displayName: undefined,
          enabled: true,
          environment: [{ name: "KIRO_TEST_RECORD", value: record, sensitive: false }],
          config: AtumKiroDriver.defaultConfig(),
        }).pipe(
          Effect.provideService(HostProcess.Platform, "darwin"),
          Effect.provideService(HostProcess.Environment, {
            ATUM_WORK_KIRO_SETUP: "1",
            PATH: "/usr/bin:/bin",
          }),
          Effect.provideService(AcpRegistryCatalog, {
            search: unused,
            prepare: unused,
            inspect: unused,
            uninstallManagedBinary: unused,
            resolve: (settings) =>
              settings.source === "local"
                ? Effect.fail(
                    new AcpRegistryError({ reason: "runner_unavailable", detail: "Missing CLI" }),
                  )
                : Effect.succeed({ distribution: "binary" as const, spawn: { command, args: [] } }),
          }),
        );
        const auth = provider.auth!;
        // Give the installer 2 GiB, above the new gate and below the previous 6 GiB.
        vi.mocked(NodeFSP.statfs).mockResolvedValueOnce({
          type: 0,
          bsize: 4096,
          blocks: 524_288,
          bfree: 524_288,
          bavail: 524_288,
          files: 0,
          ffree: 0,
        });
        const started = yield* auth.start("owner", Effect.void, method);
        const result = yield* auth.subscribe("owner").pipe(
          Stream.filter(
            (state) =>
              state.flowId === started.flowId &&
              (state.phase === "succeeded" || state.phase === "failed"),
          ),
          Stream.runHead,
          Effect.map(Option.getOrThrow),
        );
        assert.equal(result.phase, "succeeded", result.message ?? undefined);
        assert.equal(yield* fs.readLink(link), command);
        assert.equal(yield* fs.readFileString(record), method);
      }).pipe(Effect.provide(TestProviderHost.layer({ runBackgroundWork: false }))),
  );
});
