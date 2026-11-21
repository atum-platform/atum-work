import * as NodeAssert from "node:assert/strict";
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeTest from "node:test";
import { applyBrand, assertProviderIdentity, planBrand } from "./brand.mjs";

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
      const undo = applyBrand(planBrand(tmp, map));
      NodeAssert.equal(NodeFS.readFileSync(file, "utf8"), "<title>Work fixture</title>");
      assertProviderIdentity(tmp);
      undo();
      NodeAssert.equal(NodeFS.readFileSync(file, "utf8"), "<title>T3 Code</title>");
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
