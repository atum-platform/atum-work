// Copies the Atum palette (atum-work/theme/atum.json) byte for byte from the Kit's T3 theme file: the one
// palette the desktop publishes as Work's theme and the Atum web build bundles as its fallback.
// Usage: node scripts/atum-work/theme.mjs <atum-desktop>/packages/atum-kit/dist/atum-t3-theme.json
import * as NodeAssert from "node:assert/strict";
import * as NodeCrypto from "node:crypto";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";

const repo = NodePath.resolve(import.meta.dirname, "../..");

export function checkAtumPalette(theme) {
  NodeAssert.equal(theme.version, 1, "The palette must be a version 1 T3 theme file.");
  NodeAssert.equal(typeof theme.name, "string");
  NodeAssert.ok(theme.appearance === "light" || theme.appearance === "dark");
  NodeAssert.equal(typeof theme.colors, "object");
  NodeAssert.equal(theme.css, undefined, "The palette carries colours only.");
  return theme;
}

if (process.argv[1] === NodeURL.fileURLToPath(import.meta.url)) {
  const [source, output = NodePath.join(repo, "atum-work/theme/atum.json")] = process.argv.slice(2);
  NodeAssert.ok(
    source,
    "Usage: node scripts/atum-work/theme.mjs <atum-t3-theme.json> [output.json]",
  );
  const raw = NodeFS.readFileSync(source);
  checkAtumPalette(JSON.parse(raw.toString("utf8")));
  NodeFS.writeFileSync(output, raw);
  NodeFS.writeFileSync(
    output.replace(/\.json$/, ".provenance.json"),
    JSON.stringify(
      {
        source: "atum-desktop packages/atum-kit/dist/atum-t3-theme.json",
        sha256: NodeCrypto.createHash("sha256").update(raw).digest("hex"),
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`Wrote ${output}`);
}
