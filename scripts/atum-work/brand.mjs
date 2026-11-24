import * as NodeAssert from "node:assert/strict";
import * as NodeCrypto from "node:crypto";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import { resolveWebIconOverrides } from "../lib/brand-assets.ts";

const providerIdentity = {
  "apps/server/src/provider/CodexChatGptAuth.ts": 'agent_name_hint: "T3 Code"',
  "apps/server/src/provider/CodexProvider.ts": 'const CODEX_CLIENT_NAME = "T3 Code";',
};

export function assertProviderIdentity(repo) {
  for (const [file, expected] of Object.entries(providerIdentity)) {
    const source = NodeFS.readFileSync(NodePath.resolve(repo, file), "utf8");
    NodeAssert.equal(source.split(expected).length, 2, `Provider identity changed in ${file}`);
  }
}

function resolveBelow(root, file) {
  const path = NodePath.resolve(root, file);
  NodeAssert.ok(path.startsWith(root + "/"), `Path is outside ${root}: ${file}`);
  return path;
}

// Map paths are relative to apps/web. The web bundle also compiles these packages' copy.
// brand-map.mjs runs tokens only over web, shared and client-runtime; contracts takes explicit
// message-text entries, never schema shapes or literals.
const brandRoots = ["apps/web", "packages/shared", "packages/client-runtime", "packages/contracts"];

function resolveBrandTarget(repo, file) {
  const path = NodePath.resolve(repo, "apps/web", file);
  NodeAssert.ok(
    brandRoots.some((root) => path.startsWith(NodePath.resolve(repo, root) + "/")),
    `Brand target is outside ${brandRoots.join(", ")}: ${file}`,
  );
  return path;
}

export function readBrandMap(path) {
  return { data: JSON.parse(NodeFS.readFileSync(path, "utf8")), directory: NodePath.dirname(path) };
}

export function planBrand(repo, { data, directory }) {
  assertProviderIdentity(repo);
  NodeAssert.ok(Array.isArray(data.strings) && data.strings.length > 0, "Brand map needs strings");
  NodeAssert.ok(Array.isArray(data.assets), "Brand map needs an assets array");

  const writes = new Map();
  for (const { file, from, to, count } of data.strings) {
    const path = resolveBrandTarget(repo, file);
    NodeAssert.ok(
      typeof from === "string" &&
        from.length > 0 &&
        typeof to === "string" &&
        from !== to &&
        Number.isSafeInteger(count) &&
        count > 0,
      `Invalid string replacement in ${file}`,
    );
    const before = writes.get(path)?.before ?? NodeFS.readFileSync(path);
    const text = writes.get(path)?.after ?? before.toString("utf8");
    NodeAssert.equal(
      text.split(from).length - 1,
      count,
      `Brand token count changed in ${file}: ${from}`,
    );
    writes.set(path, { before, after: text.replaceAll(from, () => to) });
  }

  // B1 owns instruction resolution and snapshots. Only the Atum archive build
  // changes its decoding default; explicit owner/project values (including "") win.
  if (data.agentInstructions) {
    const instructions = NodeFS.readFileSync(resolveBelow(repo, data.agentInstructions), "utf8");
    NodeAssert.ok(Buffer.byteLength(instructions, "utf8") < 4000 && instructions.trim());
    const path = resolveBrandTarget(repo, "../../packages/contracts/src/settings.ts");
    const before = writes.get(path)?.before ?? NodeFS.readFileSync(path);
    const text = writes.get(path)?.after ?? before.toString("utf8");
    const from =
      'agentInstructions: AgentInstructions.pipe(Schema.withDecodingDefault(Effect.succeed("")))';
    NodeAssert.equal(text.split(from).length - 1, 1, "B1 instruction default changed");
    writes.set(path, {
      before,
      after: text.replace(
        from,
        `agentInstructions: AgentInstructions.pipe(Schema.withDecodingDefault(Effect.succeed(${JSON.stringify(instructions)})))`,
      ),
    });
  }

  for (const { file, source, upstreamSha256 } of data.assets) {
    const path = resolveBrandTarget(repo, file);
    NodeAssert.ok(!writes.has(path), `Duplicate brand target: ${file}`);
    const before = NodeFS.readFileSync(path);
    const after = NodeFS.readFileSync(resolveBelow(directory, source));
    NodeAssert.equal(
      NodeCrypto.createHash("sha256").update(before).digest("hex"),
      upstreamSha256,
      `Upstream asset changed: ${file}`,
    );
    NodeAssert.ok(
      after.length > 0 && !before.equals(after),
      `Asset replacement made no change: ${file}`,
    );
    writes.set(path, { before, after });
  }

  return writes;
}

export function applyBrand(writes) {
  const applied = new Map();
  const restore = () => {
    for (const [path, before] of applied) NodeFS.writeFileSync(path, before);
  };
  try {
    for (const [path, { before, after }] of writes) {
      applied.set(path, before);
      NodeFS.writeFileSync(path, after);
    }
    return restore;
  } catch (error) {
    restore();
    throw error;
  }
}

export function installArchiveIcons(repo, { data, directory }) {
  const paths = resolveWebIconOverrides(
    "development",
    NodePath.resolve(repo, "apps/server/dist/client"),
  );
  const expected = paths.map(({ targetRelativePath }) => targetRelativePath.split("/").at(-1));
  NodeAssert.deepEqual(
    Object.keys(data.icons ?? {}).sort(),
    expected.sort(),
    "Provide all archive icons",
  );
  for (const { targetRelativePath } of paths) {
    const name = targetRelativePath.split("/").at(-1);
    const before = NodeFS.readFileSync(targetRelativePath);
    const after = NodeFS.readFileSync(resolveBelow(directory, data.icons[name]));
    NodeAssert.ok(
      after.length > 0 && !before.equals(after),
      `Icon replacement made no change: ${name}`,
    );
    NodeFS.writeFileSync(targetRelativePath, after);
  }
}

if (import.meta.main) {
  const [mode, map] = process.argv.slice(2);
  const repo = NodePath.resolve(import.meta.dirname, "../..");
  if (mode === "--check-identity") {
    assertProviderIdentity(repo);
  } else if (mode === "--check" && map) {
    console.log(
      `Brand map validated for ${planBrand(repo, readBrandMap(NodePath.resolve(map))).size} files`,
    );
  } else {
    throw new Error(
      "Usage: node scripts/atum-work/brand.mjs --check <brand.json> | --check-identity",
    );
  }
}
