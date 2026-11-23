import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
const map = JSON.parse(
  NodeFS.readFileSync(new URL("../src/atum/atum-icon-map.json", import.meta.url)),
);
export const atumIconAlias = {
  find: /^lucide-react$/,
  replacement: NodeURL.fileURLToPath(new URL("../src/atum/lucide-phosphor.tsx", import.meta.url)),
};
export function checkAtumIconImports(source, file) {
  if (
    /import\s+(?!type\b)(?:\*\s+as\s+\w+|\w+)\s+from\s*["']lucide-react["']|import\s*\(["']lucide-react["']\)/s.test(
      source,
    )
  )
    throw new Error(`${file}: use named mapped Lucide imports`);
  for (const match of source.matchAll(
    /(?:import|export)\s+(type\s+)?\{([^}]+)\}\s+from\s*["']lucide-react["']/gs,
  )) {
    if (match[1]) continue;
    for (const item of match[2].split(",")) {
      const name = item.trim().split(/\s+as\s+/)[0];
      if (
        !name ||
        name.startsWith("type ") ||
        ["LucideIcon", "LucideProps", "IconNode", "createLucideIcon"].includes(name)
      )
        continue;
      if (!map[name] && !map[name.replace(/Icon$/, "")])
        throw new Error(`${file}: unmapped Lucide icon ${name}`);
    }
  }
}
export function atumIconsPlugin() {
  return {
    name: "atum-icons",
    async buildStart() {
      await import("../scripts/build-atum-icons.mjs");
      function visit(dir) {
        for (const item of NodeFS.readdirSync(dir, { withFileTypes: true })) {
          const path = `${dir}/${item.name}`;
          if (item.isDirectory()) visit(path);
          else if (
            /\.[jt]sx?$/.test(path) &&
            !path.includes("/atum/lucide-phosphor") &&
            !path.includes(".test.") &&
            !path.endsWith("/lib/lucideIconByName.ts")
          )
            checkAtumIconImports(NodeFS.readFileSync(path, "utf8"), path);
        }
      }
      visit(NodeURL.fileURLToPath(new URL("../src", import.meta.url)));
    },
  };
}
