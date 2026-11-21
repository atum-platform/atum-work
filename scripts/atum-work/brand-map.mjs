// Expands atum-work/brand.rules.json into the exact-count map that brand.mjs applies.
// The output is reviewed data: after a pin bump, rerun this and read the count diff.
import * as NodeAssert from "node:assert/strict";
import * as NodeCrypto from "node:crypto";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";

const repo = NodePath.resolve(import.meta.dirname, "../..");
const web = NodePath.join(repo, "apps/web");
const rulesPath = NodePath.resolve(
  process.argv[2] ?? NodePath.join(repo, "atum-work/brand.rules.json"),
);
const outPath = NodePath.resolve(
  process.argv[3] ?? NodePath.join(NodePath.dirname(rulesPath), "brand.json"),
);
const rules = JSON.parse(NodeFS.readFileSync(rulesPath, "utf8"));
const excluded = rules.exclude.map((pattern) => new RegExp(pattern));
const relative = (path) => NodePath.relative(web, path);

function listFiles(entry) {
  const path = NodePath.resolve(web, entry);
  if (NodeFS.statSync(path).isFile()) return [path];
  return NodeFS.readdirSync(path, { recursive: true, withFileTypes: true })
    .filter((dirent) => dirent.isFile())
    .map((dirent) => NodePath.join(dirent.parentPath, dirent.name));
}

const scanned = new Set(
  rules.scan
    .flatMap(listFiles)
    .filter((path) => rules.extensions.includes(NodePath.extname(path)))
    .filter((path) => !excluded.some((pattern) => pattern.test(path))),
);
const explicit = new Map();
for (const entry of rules.files) {
  const key = NodePath.resolve(web, entry.file);
  explicit.set(key, [...(explicit.get(key) ?? []), entry]);
}
// Files named only by explicit entries (packages/contracts message text) get no token pass.
const targets = [...new Set([...scanned, ...explicit.keys()])].sort();

// A token matches only after a non-identifier character, so `allT3 ` stays code. A `\n` escape
// in source also counts, so label lists joined with newlines stay equal to their lookup keys.
// Each distinct prefix becomes its own literal entry, which brand.mjs applies as written.
function boundedEntries(text, { from, to }) {
  const before = new Set();
  for (let at = text.indexOf(from); at !== -1; at = text.indexOf(from, at + 1)) {
    const previous = text[at - 1];
    if (text.slice(at - 2, at) === "\\n") before.add("\\n");
    else if (previous !== undefined && !/[A-Za-z0-9_$]/.test(previous)) before.add(previous);
  }
  return [...before].sort().map((c) => ({ from: c + from, to: c + to }));
}

const strings = [];
for (const path of targets) {
  let text = NodeFS.readFileSync(path, "utf8");
  const apply = ({ from, to }) => {
    const count = text.split(from).length - 1;
    if (count > 0) {
      strings.push({ file: relative(path), from, to, count });
      text = text.replaceAll(from, () => to);
    }
    return count;
  };
  for (const entry of explicit.get(path) ?? []) {
    NodeAssert.ok(apply(entry) > 0, `Explicit entry missed: ${relative(path)}: ${entry.from}`);
  }
  if (!scanned.has(path)) continue;
  for (const token of rules.tokens) {
    if (token.skip?.some((file) => NodePath.resolve(web, file) === path)) continue;
    for (const entry of boundedEntries(text, token)) apply(entry);
  }
}

const assets = rules.assets.map(({ file, source }) => ({
  file,
  source,
  upstreamSha256: NodeCrypto.createHash("sha256")
    .update(NodeFS.readFileSync(NodePath.resolve(web, file)))
    .digest("hex"),
}));
const assetFiles = new Set(assets.map(({ file }) => NodePath.resolve(web, file)));
NodeAssert.ok(
  !strings.some(({ file }) => assetFiles.has(NodePath.resolve(web, file))),
  "A whole-file asset replacement also has string replacements",
);

NodeFS.writeFileSync(
  outPath,
  JSON.stringify({ strings, assets, icons: rules.icons }, null, 2) + "\n",
);
const files = new Set(strings.map(({ file }) => file)).size;
console.log(`${strings.length} replacements in ${files} files, ${assets.length} assets`);
