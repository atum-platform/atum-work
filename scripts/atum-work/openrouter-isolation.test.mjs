import * as NodeAssert from "node:assert/strict";
import * as NodeChildProcess from "node:child_process";
import * as NodeFSP from "node:fs/promises";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeTest from "node:test";
import * as NodeUtil from "node:util";
import {
  OPENROUTER_FREE_VERSION,
  openRouterFreeConfig,
  openRouterFreePlugin,
} from "../../packages/provider-opencode/src/server/openRouterFreePolicy.ts";

const free = "google/gemma-4-26b-a4b-it:free";
function nativeReleaseAvailable() {
  try {
    return (
      NodeChildProcess.execFileSync("opencode", ["--version"], {
        encoding: "utf8",
        timeout: 2_000,
      }).trim() === `opencode v${OPENROUTER_FREE_VERSION}`
    );
  } catch {
    return false;
  }
}

NodeTest.test(
  "isolates the OpenRouter credential and model list from ordinary OpenCode",
  { skip: nativeReleaseAvailable() ? false : "Requires OpenCode 2.3.2" },
  async () => {
    const root = await NodeFSP.mkdtemp(NodePath.join(NodeOS.tmpdir(), "atum-opencode-isolation-"));
    try {
      const plugin = NodePath.join(root, "policy");
      const data = NodePath.join(root, "free");
      const auth = NodePath.join(data, "opencode");
      await Promise.all([NodeFSP.mkdir(plugin), NodeFSP.mkdir(auth, { recursive: true })]);
      await NodeFSP.writeFile(NodePath.join(plugin, "index.ts"), openRouterFreePlugin);
      // Fixture for OpenCode's built-in auth migration. No browser or authenticated provider request.
      await NodeFSP.writeFile(
        NodePath.join(auth, "auth.json"),
        JSON.stringify({ openrouter: { type: "api", key: "fixture-openrouter-key" } }),
        { mode: 0o600 },
      );
      const run = NodeUtil.promisify(NodeChildProcess.execFile);
      const models = (home, config) =>
        run("opencode", ["models", "--standalone"], {
          cwd: root,
          timeout: 35_000,
          env: {
            PATH: process.env.PATH,
            HOME: root,
            XDG_DATA_HOME: home,
            XDG_CONFIG_HOME: NodePath.join(root, "config"),
            XDG_CACHE_HOME: NodePath.join(root, "cache"),
            XDG_STATE_HOME: NodePath.join(home, "state"),
            OPENCODE_CONFIG_CONTENT: config,
            OPENCODE_DISABLE_PROJECT_CONFIG: "1",
          },
        }).then(({ stdout }) => stdout.trim().split("\n").filter(Boolean));
      const dedicated = await models(data, openRouterFreeConfig(plugin));
      const ordinary = await models(
        NodePath.join(root, "ordinary"),
        JSON.stringify({ disabled_providers: ["openrouter"], autoupdate: false }),
      );
      NodeAssert.ok(dedicated.includes(`openrouter/${free}`));
      NodeAssert.ok(dedicated.every((id) => id.startsWith("openrouter/") && id.endsWith(":free")));
      NodeAssert.ok(ordinary.every((id) => !id.startsWith("openrouter/")));
    } finally {
      await NodeFSP.rm(root, { recursive: true, force: true });
    }
  },
);
