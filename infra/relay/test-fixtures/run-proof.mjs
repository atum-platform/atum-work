import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../..", import.meta.url));
for (const args of [
  [
    "--experimental-strip-types",
    "--test",
    "infra/relay/test-fixtures/atum-assertion.mjs",
    "infra/relay/test-fixtures/atum-seam.mjs",
    "infra/relay/test-fixtures/dpop-key-theft.mjs",
  ],
  ["--experimental-strip-types", "infra/relay/test-fixtures/loopback.mjs"],
]) {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
