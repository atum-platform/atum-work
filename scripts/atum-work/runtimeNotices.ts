// @effect-diagnostics nodeBuiltinImport:off - The existing license generator reads installed manifests with Node.
import * as NodeFSP from "node:fs/promises";
import * as NodePath from "node:path";
import { generateThirdPartyLicenseManifest } from "../lib/third-party-licenses.ts";

export async function writeRuntimeNotices(contentDir: string, repoRoot: string): Promise<void> {
  const nodeModules = NodePath.join(contentDir, "node_modules");
  const files = await NodeFSP.readdir(nodeModules, { withFileTypes: true, recursive: true });
  const installedPackageManifests = files.flatMap((file) => {
    if (!file.isFile() || file.name !== "package.json") return [];
    const parent = file.parentPath.split("/").slice(nodeModules.split("/").length);
    const lastNodeModules = parent.lastIndexOf("node_modules");
    const packagePath = parent.slice(lastNodeModules + 1);
    const depth = packagePath[0]?.startsWith("@") ? 2 : 1;
    return packagePath.length === depth ? [NodePath.join(file.parentPath, file.name)] : [];
  });
  const manifest = await generateThirdPartyLicenseManifest({
    configFile: NodePath.join(repoRoot, "third-party-licenses.config.json"),
    packageManifests: [],
    bundledModuleIds: installedPackageManifests,
    bundleName: "standalone-runtime",
  });
  if (manifest.entries.length === 0) throw new Error("The archive contains no runtime notices");
  await NodeFSP.writeFile(
    NodePath.join(contentDir, "licenses", "runtime-npm.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
}
