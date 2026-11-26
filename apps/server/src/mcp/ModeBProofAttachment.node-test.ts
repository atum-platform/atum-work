import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import * as ProviderAdapter from "@t3tools/provider-core/server/ProviderAdapter";
import {
  claudeEffectiveQueryPolicyKey,
  claudeMcpQueryOverrides,
  claudeRuntimeQueryPolicyForRuntimePolicy,
} from "../orchestration-v2/Adapters/ClaudeAdapterV2.ts";
import { selectModeBProofAttachment } from "./ModeBProofAttachment.ts";

test("one loopback turn attachment feeds Claude's native config and rotates the query key", () => {
  const input = {
    threadId: "thread-main",
    origin: "http://127.0.0.1:43210",
    bearer: randomBytes(32).toString("base64url"),
    expiresAt: 1000,
  };
  const rotate = { ...input, bearer: randomBytes(32).toString("base64url") };
  const queryPolicy = claudeRuntimeQueryPolicyForRuntimePolicy(
    ProviderAdapter.ProviderAdapterV2RuntimePolicy.make({
      runtimeMode: "approval-required",
      interactionMode: "default",
      cwd: "/workspace",
    }),
  );
  const overrides = (attachment: typeof input) =>
    claudeMcpQueryOverrides({
      mcpSession: undefined,
      managedMcpServers: selectModeBProofAttachment(attachment, input.threadId, 999),
      readOnlySandbox: false,
    });
  assert.equal(
    overrides(input).mcpServers?.["hermes-slice0"]?.type,
    "http",
  );
  const initial = claudeEffectiveQueryPolicyKey(queryPolicy, overrides(input));
  const rotated = claudeEffectiveQueryPolicyKey(queryPolicy, overrides(rotate));
  assert.ok(initial.includes(input.bearer));
  assert.notEqual(initial, rotated);
  assert.deepEqual(selectModeBProofAttachment(input, "sibling", 999), []);
  assert.deepEqual(selectModeBProofAttachment(input, input.threadId, 1000), []);
  assert.deepEqual(
    selectModeBProofAttachment({ ...input, origin: "http://localhost:43210" }, input.threadId, 999),
    [],
  );
});

test("the inherited pipe supplies the header without putting it in process arguments", async (t) => {
  const attachmentUrl = new URL("./ModeBProofAttachment.ts", import.meta.url).href;
  const child = spawn(process.execPath, [
    "--input-type=module", "-e", `
      import { readModeBProofAttachment } from ${JSON.stringify(attachmentUrl)};
      const timer = setInterval(() => {
        const main = readModeBProofAttachment("thread-main");
        if (main.length === 0) return;
        clearInterval(timer);
        const isolated = readModeBProofAttachment("sibling").length === 0;
        console.log(JSON.stringify({ attached: main[0].name === "hermes-slice0", isolated }));
      }, 10);
    `,
  ], {
    env: { ...process.env, MODEB_SLICE0_ATTACHMENT_FD: "0" },
    stdio: ["pipe", "pipe", "inherit"],
  });
  t.after(() => child.kill());
  const timeout = AbortSignal.timeout(5000);
  child.stdin.write(JSON.stringify({
    threadId: "thread-main",
    origin: "http://127.0.0.1:43210",
    bearer: randomBytes(32).toString("base64url"),
    expiresAt: Date.now() + 5000,
  }) + "\n");
  const [result] = await once(child.stdout, "data", { signal: timeout });
  assert.deepEqual(JSON.parse(result.toString()), { attached: true, isolated: true });
  child.stdin.end();
  assert.deepEqual(await once(child, "exit", { signal: timeout }), [0, null]);
});
