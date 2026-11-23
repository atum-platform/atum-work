import * as NodeAssert from "node:assert/strict";
import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { build } from "vite-plus";
import { atumIconsPlugin, atumIconAlias, checkAtumIconImports } from "../vite/atumIcons.mjs";
NodeAssert.equal(process.env.VITE_ATUM_WORK_BUILD, "1");
NodeAssert.throws(
  () => checkAtumIconImports('import { NewlyAddedIcon } from "lucide-react"', "fixture.tsx"),
  /unmapped/,
);
const root = NodeURL.fileURLToPath(new URL("../", import.meta.url));
const scratch = NodeFS.mkdtempSync(`${root}.atum-icon-check-`);
try {
  NodeFS.writeFileSync(
    `${scratch}/entry.ts`,
    'export { Search, SearchIcon, PanelRight, LoaderCircle } from "lucide-react";',
  );
  const output = await build({
    configFile: false,
    root,
    plugins: [atumIconsPlugin()],
    resolve: { alias: [atumIconAlias] },
    build: {
      write: false,
      lib: { entry: `${scratch}/entry.ts`, formats: ["es"] },
      rollupOptions: { external: ["react", "react/jsx-runtime"] },
    },
  });
  const text = (Array.isArray(output) ? output : [output])
    .flatMap((result) => result.output)
    .map((item) => (item.type === "chunk" ? item.code : ""))
    .join("\n");
  NodeAssert.match(text, /minWidth: 16/);
  NodeAssert.match(text, /0 0 256 256/);
  NodeAssert.doesNotMatch(text, /createLucideIcon/);
} finally {
  NodeFS.rmSync(scratch, { recursive: true, force: true });
}
