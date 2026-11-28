// The official installer accepts a local binary, so verify the pinned release before running it.
// @effect-diagnostics-next-line nodeBuiltinImport:off
import { createHash } from "node:crypto";
// @effect-diagnostics-next-line nodeBuiltinImport:off
import { statfs } from "node:fs/promises";
import { runBrowserLoginCommand } from "@t3tools/provider-core/server/providerAuthFlow";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Stream from "effect/Stream";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { ProviderInstanceId } from "@t3tools/contracts";

import { openRouterSetupError } from "./openRouterFreeAuth.ts";
import { OPENROUTER_FREE_VERSION } from "./openRouterFreePolicy.ts";

const installerSha256 = "bbc4584fd6a888bcd14623b8a63afa0f1b4075a2e84a2c3518cd509b446b3135";
// Published npm dist.integrity values for the official macOS 2.3.2 release.
const darwinArchives = {
  arm64: {
    target: "darwin-arm64",
    sha512:
      "cYrIzW8CvYc52INFA/cXmw7U2mk+JNWaV+olH7AflYqa/5srSrA/hbLwF7G1N4QTRMtOFrmeTM0LVN81q396sg==",
  },
  x64: {
    target: "darwin-x64-baseline",
    sha512:
      "3jFsRoamhPAzMEzhIDDWteqElOlfW45jnP/5JKKQcQXsCEZ9WDMz8XzDzOaO7xInsCY0XDaUhEF2HrvP5iTIWw==",
  },
};

export const installOpenRouterFreeOpenCode = Effect.fn("installOpenRouterFreeOpenCode")(
  function* (input: {
    readonly instanceId: ProviderInstanceId;
    readonly directory: string;
    readonly platform: string;
    readonly architecture: string;
  }) {
    const failure = (detail: string) => openRouterSetupError(input.instanceId, "start", detail);
    const release =
      input.architecture === "arm64"
        ? darwinArchives.arm64
        : input.architecture === "x64"
          ? darwinArchives.x64
          : undefined;
    if (input.platform !== "darwin" || !release) {
      return yield* failure("Install OpenCode 2.3.x to connect OpenRouter Free.");
    }
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
    const error = failure("Could not install OpenCode. Try again.");
    const disk = yield* Effect.tryPromise({
      try: () => statfs(input.directory),
      catch: () => failure("Could not check available space for OpenCode."),
    });
    if (disk.bavail * disk.bsize < 1.5 * 1024 ** 3) {
      return yield* failure("Free up 1.5 GB of disk space to install OpenCode.");
    }
    const staging = yield* fs
      .makeTempDirectoryScoped({
        directory: input.directory,
        prefix: "install-",
      })
      .pipe(Effect.mapError(() => error));
    const run = (command: string, args: ReadonlyArray<string>) =>
      runBrowserLoginCommand(spawner, command, args, {
        cwd: staging,
        env: { PATH: "/usr/bin:/bin", HOME: staging },
        error,
      });
    const download = (url: string, file: string) =>
      run("/usr/bin/curl", [
        "--fail",
        "--silent",
        "--show-error",
        "--location",
        "--output",
        file,
        url,
      ]);
    const script = path.join(staging, "install");
    const archive = path.join(staging, "opencode.tgz");
    const verify = Effect.fn("OpenRouterFree.verifyDownload")(function* (
      file: string,
      algorithm: string,
      encoding: "hex" | "base64",
      expected: string,
    ) {
      const hash = createHash(algorithm);
      yield* fs.stream(file).pipe(
        Stream.runForEach((chunk) =>
          Effect.sync(() => {
            hash.update(chunk);
          }),
        ),
        Effect.mapError(() => error),
      );
      if (hash.digest(encoding) !== expected) return yield* error;
    });

    yield* download(
      `https://raw.githubusercontent.com/anomalyco/opencode/v${OPENROUTER_FREE_VERSION}/install`,
      script,
    );
    yield* verify(script, "sha256", "hex", installerSha256);
    yield* download(
      `https://registry.npmjs.org/@opencode/cli-${release.target}/-/cli-${release.target}-${OPENROUTER_FREE_VERSION}.tgz`,
      archive,
    );
    yield* verify(archive, "sha512", "base64", release.sha512);
    const binary = "package/bin/opencode";
    yield* run("/usr/bin/tar", ["-xzf", archive, binary]);
    yield* run("/bin/bash", [script, "--binary", path.join(staging, binary), "--no-modify-path"]);

    const binDir = path.join(input.directory, "bin");
    yield* fs.makeDirectory(binDir, { recursive: true }).pipe(Effect.mapError(() => error));
    yield* fs
      .rename(path.join(staging, ".opencode", "bin", "opencode"), path.join(binDir, "opencode"))
      .pipe(Effect.mapError(() => error));
  },
);
