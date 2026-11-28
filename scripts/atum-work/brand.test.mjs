import * as NodeAssert from "node:assert/strict";
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeTest from "node:test";
import { assertWorkBrandText } from "../../packages/shared/src/workBrandCheck.ts";
import { applyBrand, assertProviderIdentity, planBrand } from "./brand.mjs";

NodeTest.test("the presentation gate rejects hidden and encoded legacy text", () => {
  assertWorkBrandText("model", "Use the Work browser panel.");
  for (const text of [
    "T3 Code",
    "mcp__t3_code__thread_wait",
    "Hermes Agent",
    "T3%20Code",
    "&#84;3 Code",
    "Ｔ３",
  ]) {
    NodeAssert.throws(() => assertWorkBrandText("model", text), /Legacy product text/);
  }
  NodeAssert.throws(() => assertWorkBrandText("missing", ""), /Missing Work brand fixture/);
  assertWorkBrandText("ACP", "Read T3_ACP_MCP_NODE", ["T3_ACP_MCP_NODE"]);
  NodeAssert.throws(() => assertWorkBrandText("UI", "Read T3_ACP_MCP_NODE"), /Legacy product text/);
});

NodeTest.test(
  "the source map changes only asserted occurrences and restores the original bytes",
  () => {
    const tmp = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "atum-work-brand-test-"));
    const providerDir = NodePath.join(tmp, "apps/server/src/provider");
    const webDir = NodePath.join(tmp, "apps/web");
    NodeFS.mkdirSync(providerDir, { recursive: true });
    NodeFS.mkdirSync(webDir, { recursive: true });
    const auth = NodePath.join(providerDir, "CodexChatGptAuth.ts");
    NodeFS.writeFileSync(auth, 'agent_name_hint: "T3 Code"');
    NodeFS.writeFileSync(
      NodePath.join(providerDir, "CodexProvider.ts"),
      'const CODEX_CLIENT_NAME = "T3 Code";',
    );
    const file = NodePath.join(webDir, "index.html");
    NodeFS.writeFileSync(file, "<title>T3 Code</title>");
    const strings = [{ file: "index.html", from: "T3 Code", to: "Work fixture", count: 1 }];
    const map = { directory: tmp, data: { strings, assets: [] } };
    try {
      const settings = NodePath.join(tmp, "packages/contracts/src/settings.ts");
      NodeFS.mkdirSync(NodePath.dirname(settings), { recursive: true });
      const original =
        'agentInstructions: AgentInstructions.pipe(Schema.withDecodingDefault(Effect.succeed("")))';
      NodeFS.writeFileSync(settings, original);
      NodeFS.writeFileSync(NodePath.join(tmp, "instructions.txt"), "Atum orientation\n");
      const brandedMap = { ...map, data: { ...map.data, agentInstructions: "instructions.txt" } };
      // Ordinary upstream maps leave the default untouched.
      NodeAssert.ok(!planBrand(tmp, map).has(settings));
      const undo = applyBrand(planBrand(tmp, brandedMap));
      NodeAssert.ok(
        NodeFS.readFileSync(settings, "utf8").includes('Effect.succeed("Atum orientation\\n")'),
      );

      NodeAssert.equal(NodeFS.readFileSync(file, "utf8"), "<title>Work fixture</title>");
      assertProviderIdentity(tmp);
      undo();
      NodeAssert.equal(NodeFS.readFileSync(file, "utf8"), "<title>T3 Code</title>");
      NodeAssert.equal(NodeFS.readFileSync(settings, "utf8"), original);
      const outside = { file: "../server/src/x.ts", from: "T3", to: "Atum", count: 1 };
      NodeAssert.throws(
        () => planBrand(tmp, { directory: tmp, data: { strings: [outside], assets: [] } }),
        /Brand target is outside/,
      );
      strings[0].count = 2;
      NodeAssert.throws(() => planBrand(tmp, map), /Brand token count changed/);
      NodeFS.writeFileSync(auth, 'agent_name_hint: "Changed"');
      NodeAssert.throws(() => planBrand(tmp, map), /Provider identity changed/);
    } finally {
      NodeFS.rmSync(tmp, { recursive: true, force: true });
    }
  },
);
