// Effect FileSystem has no API for filesystem capacity.
// @effect-diagnostics-next-line nodeBuiltinImport:off
import * as NodeFSP from "node:fs/promises";
import { ProviderSetupError } from "@t3tools/contracts";
import { KiroDriver } from "@t3tools/provider-kiro/server";
import {
  AcpRegistryCatalog,
  type AcpRegistryAgent,
} from "@t3tools/provider-acp-registry/server/AcpRegistrySupport";
import { AcpRegistrySettings } from "@t3tools/provider-acp-registry/settings";
import { ProviderHost } from "@t3tools/provider-core/server/ProviderHost";
import { mergeProviderInstanceEnvironment } from "@t3tools/provider-core/server/instanceEnvironment";
import { make, runBrowserLoginCommand } from "@t3tools/provider-core/server/providerAuthFlow";
import * as HostProcess from "@t3tools/shared/HostProcess";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";

// Pinned Darwin entry from ACP Registry v1 (agentclientprotocol/registry#810).
const darwinKiro = {
  archive: "https://prod.download.cli.kiro.dev/stable/3.6.2/kirocli-universal-darwin.tar.gz",
  sha256: "d752571286636c5f69a6115d39c92e3ffb83ce91a6f6061ef19e12f280b50c21",
  cmd: "./kirocli/bin/kiro-cli",
  args: ["acp"],
};
const pinnedKiro = {
  id: "kiro",
  name: "Kiro",
  version: "3.6.2",
  description: "Kiro CLI",
  distribution: { binary: { "darwin-aarch64": darwinKiro, "darwin-x86_64": darwinKiro } },
} satisfies AcpRegistryAgent;
const decode = Schema.decodeSync(AcpRegistrySettings);

export const AtumKiroDriver = {
  ...KiroDriver,
  create: Effect.fn("AtumKiroDriver.create")(function* (
    input: Parameters<typeof KiroDriver.create>[0],
  ) {
    const platform = yield* HostProcess.Platform;
    const hostEnvironment = yield* HostProcess.Environment;
    if (
      platform !== "darwin" ||
      hostEnvironment.ATUM_WORK_KIRO_SETUP !== "1" ||
      input.instanceId !== "kiro" ||
      input.config.binaryPath !== "kiro-cli"
    ) {
      return yield* KiroDriver.create(input);
    }

    const { instanceId } = input;
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const catalog = yield* AcpRegistryCatalog;
    const {
      paths: { cwd, baseDir },
    } = yield* ProviderHost;
    const env = yield* mergeProviderInstanceEnvironment(input.environment, hostEnvironment);
    delete env.KIRO_API_KEY;
    const base = yield* KiroDriver.create({
      ...input,
      environment: input.environment.filter(({ name }) => name !== "KIRO_API_KEY"),
    });
    const local = decode({ source: "local", commandPath: "kiro-cli" });
    const failure = (detail: string) =>
      new ProviderSetupError({ instanceId, operation: "start", detail });

    const auth = yield* make({
      instanceId,
      credentialBinding: { owner: "provider", key: "kiro-cli" },
      methods: Effect.succeed([
        { id: "google", name: "Sign in with Google", description: null, type: "agent" },
        { id: "github", name: "Sign in with GitHub", description: null, type: "agent" },
      ]),
      authenticate: Effect.fn("Kiro.browserLogin")(function* (method) {
        const resolved = yield* catalog.resolve(local, cwd, env).pipe(Effect.option);
        let command: string;
        if (Option.isSome(resolved)) {
          command = resolved.value.spawn.command;
        } else {
          const disk = yield* Effect.tryPromise({
            try: () => NodeFSP.statfs(baseDir),
            catch: () => failure("Could not check available space for Kiro."),
          });
          if (disk.bavail * disk.bsize < 1.5 * 1024 ** 3) {
            return yield* failure("Free up 1.5 GB of disk space to install Kiro.");
          }
          const error = failure("Could not install Kiro. Try again.");
          const installed = yield* catalog
            .resolve(
              decode({
                source: "registry",
                agentId: pinnedKiro.id,
                distribution: "binary",
              }),
              cwd,
              env,
              pinnedKiro,
            )
            .pipe(Effect.mapError(() => error));
          command = installed.spawn.command;
          const directory = path.join(baseDir, "tools", "kiro-free");
          yield* fs
            .makeDirectory(directory, { recursive: true })
            .pipe(Effect.mapError(() => error));
          const link = path.join(directory, "kiro-cli");
          // readLink also recognizes dangling links and leaves ordinary files alone.
          const previous = yield* fs.readLink(link).pipe(Effect.option);
          if (Option.isSome(previous)) {
            yield* fs.remove(link, { force: true }).pipe(Effect.mapError(() => error));
          }
          yield* fs.symlink(command, link).pipe(Effect.mapError(() => error));
        }
        yield* runBrowserLoginCommand(spawner, command, ["login", "--social", method], {
          cwd,
          env,
          error: failure("Could not finish Kiro sign-in. Try again."),
        });
        yield* base.snapshot.refresh;
      }),
      logout: Effect.scoped(
        Effect.gen(function* () {
          const error = new ProviderSetupError({
            instanceId,
            operation: "logout",
            detail: "Could not sign out of Kiro. Try again.",
          });
          const { spawn } = yield* catalog
            .resolve(local, cwd, env)
            .pipe(Effect.mapError(() => error));
          yield* runBrowserLoginCommand(spawner, spawn.command, ["logout"], { cwd, env, error });
          yield* base.snapshot.refresh;
        }),
      ),
    });
    return { ...base, auth };
  }),
};
