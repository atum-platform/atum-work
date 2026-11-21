import * as NodeAssert from "node:assert/strict";
import * as NodeChildProcess from "node:child_process";
import * as NodeCrypto from "node:crypto";
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import {
  applyBrand,
  assertProviderIdentity,
  installArchiveIcons,
  planBrand,
  readBrandMap,
} from "./brand.mjs";

const repo = NodePath.resolve(import.meta.dirname, "../..");
const rustTarget = "aarch64-apple-darwin";
const rustManifest = "native/resource-monitor/Cargo.toml";
const [pin, brandPath, nodeLicensePath, destination] = process.argv.slice(2);

NodeAssert.ok(
  pin && /^v\d+\.\d+\.\d+$/.test(pin) && brandPath && nodeLicensePath && destination,
  "Usage: node scripts/atum-work/build.mjs <stable-tag> <brand.json> <Node LICENSE> <output-directory>",
);
// oxlint-disable-next-line t3code/no-global-process-runtime -- The standalone build entrypoint checks its host before the build toolchain starts.
NodeAssert.equal(`${NodeOS.platform()}-${NodeOS.arch()}`, "darwin-arm64");
const expectedNode = JSON.parse(NodeFS.readFileSync(NodePath.join(repo, "package.json"), "utf8"))
  .engines.node;
NodeAssert.equal(
  process.versions.node,
  expectedNode,
  "Build with the same Node version that will be embedded",
);
const version = pin.slice(1);
const outputDir = NodePath.resolve(destination);
for (const file of [".env", ".env.local"]) {
  NodeAssert.ok(
    !NodeFS.existsSync(NodePath.join(repo, file)),
    `Use a dedicated checkout without ${file}`,
  );
}
const brand = readBrandMap(NodePath.resolve(brandPath));
const writes = planBrand(repo, brand);

const env = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !/^(T3CODE_|VITE_|APPLE_API_KEY|OTEL_)/.test(key)),
);
Object.assign(env, {
  APP_VERSION: version,
  VITE_ATUM_WORK_BUILD: "1",
  VITE_HOSTED_APP_CHANNEL: "latest",
  VITE_RELEASE_CHANNEL: "stable",
  T3CODE_TELEMETRY_CHANNEL: "dev",
});
const run = (command, args, extra = {}) =>
  NodeChildProcess.execFileSync(command, args, { cwd: repo, env, stdio: "inherit", ...extra });

run("git", ["merge-base", "--is-ancestor", pin, "HEAD"]);
const temp = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "atum-work-build-"));
let restoreBrand;
try {
  const licenses = NodePath.join(temp, "licenses");
  NodeFS.mkdirSync(licenses);
  NodeFS.copyFileSync(NodePath.resolve(nodeLicensePath), NodePath.join(licenses, "Node-LICENSE"));
  NodeFS.writeFileSync(
    NodePath.join(licenses, "README.txt"),
    `Built on T3 Code (MIT). See ../LICENSE.\nEmbedded Node.js: ${expectedNode}.\n` +
      "Bundled web and server notices: ../client/third-party-licenses.json.\n" +
      "Staged npm externals: runtime-npm.json. Native monitor: resource-monitor/.\n",
  );

  run("cargo", [
    "build",
    "--locked",
    "--release",
    "--manifest-path",
    rustManifest,
    "--target",
    rustTarget,
  ]);
  const metadata = JSON.parse(
    run(
      "cargo",
      [
        "metadata",
        "--locked",
        "--format-version",
        "1",
        "--manifest-path",
        rustManifest,
        "--filter-platform",
        rustTarget,
      ],
      { stdio: ["ignore", "pipe", "inherit"], encoding: "utf8" },
    ),
  );
  const packages = new Map(metadata.packages.map((pkg) => [pkg.id, pkg]));
  const dependencies = new Map(metadata.resolve.nodes.map((node) => [node.id, node.deps]));
  const shipped = new Set();
  function collect(id) {
    if (shipped.has(id)) return;
    shipped.add(id);
    for (const { pkg, dep_kinds } of dependencies.get(id)) {
      if (dep_kinds.some(({ kind }) => kind === null)) collect(pkg);
    }
  }
  collect(metadata.resolve.root);

  const rustNotices = NodePath.join(licenses, "resource-monitor");
  NodeFS.mkdirSync(rustNotices);
  const inventory = [];
  for (const id of shipped) {
    if (id === metadata.resolve.root) continue; // The fork's root MIT file covers the monitor.
    const pkg = packages.get(id);
    const name = `${pkg.name}-${pkg.version}`;

    let directory = NodePath.dirname(pkg.manifest_path);
    // These locked objc2 crates omit the repository licensing statement and MIT text.
    const objc2Revisions = [
      "8852b424193ca41602281b3d7540d7c8ed51e49a",
      "7b1abfd750a2cacaea71d6a56ecfb83cb7de560b",
      "8d214f5477365ffcbcbb7de058c86ed9a518efb7",
    ];
    if (pkg.repository === "https://github.com/madsmtm/objc2") {
      const vcs = JSON.parse(
        NodeFS.readFileSync(NodePath.join(directory, ".cargo_vcs_info.json"), "utf8"),
      );
      NodeAssert.ok(objc2Revisions.includes(vcs.git.sha1), `Review the objc2 notice for ${name}`);
      directory = NodePath.join(import.meta.dirname, "licenses", "objc2");
    }
    const texts = NodeFS.readdirSync(directory, { withFileTypes: true })
      .filter(
        (file) =>
          file.isFile() &&
          /^(licen[sc]e|copying|copyright|notice|unlicense)([._-]|$)/i.test(file.name),
      )
      .map((file) => file.name);
    if (
      pkg.license_file &&
      directory === NodePath.dirname(pkg.manifest_path) &&
      !texts.includes(pkg.license_file)
    )
      texts.push(pkg.license_file);
    NodeAssert.ok(
      texts.length > 0,
      `Missing resource monitor dependency notice: ${name} (${pkg.license})`,
    );
    NodeFS.mkdirSync(NodePath.join(rustNotices, name));
    for (const file of texts)
      NodeFS.copyFileSync(
        NodePath.join(directory, file),
        NodePath.join(rustNotices, name, NodePath.basename(file)),
      );
    inventory.push({
      name,
      license: pkg.license,
      notices: texts.map((file) => NodePath.basename(file)).sort(),
    });
  }
  inventory.sort((a, b) => a.name.localeCompare(b.name));
  NodeFS.writeFileSync(
    NodePath.join(rustNotices, "inventory.json"),
    JSON.stringify(inventory, null, 2) + "\n",
  );

  const monitor = NodePath.join(temp, "resource-monitor");
  NodeFS.mkdirSync(monitor);
  NodeFS.copyFileSync(
    NodePath.join(metadata.target_directory, rustTarget, "release", "t3-resource-monitor"),
    NodePath.join(monitor, "t3-resource-monitor"),
  );

  restoreBrand = applyBrand(writes);
  run("vp", ["build"], { cwd: NodePath.join(repo, "apps/web") });
  run(process.execPath, ["apps/server/scripts/cli.ts", "build", "--verbose"]);
  installArchiveIcons(repo, brand);
  run(process.execPath, ["apps/server/scripts/cli.ts", "build-exe", "--verbose"]);
  assertProviderIdentity(repo);

  run(process.execPath, [
    "scripts/build-cli-archive.ts",
    "--platform",
    "mac",
    "--arch",
    "arm64",
    "--version",
    version,
    "--resource-monitor-dir",
    monitor,
    "--notice-dir",
    licenses,
    "--output-dir",
    temp,
  ]);
  NodeFS.mkdirSync(outputDir, { recursive: true });
  const name = `atum-work-${version}-darwin-arm64.tar.gz`;
  const archivePath = NodePath.join(outputDir, name);
  const sourceArchive = NodePath.join(temp, `t3-${version}-darwin-arm64.tar.gz`);
  const hash = NodeCrypto.createHash("sha256");
  for await (const chunk of NodeFS.createReadStream(sourceArchive)) hash.update(chunk);
  try {
    NodeFS.renameSync(sourceArchive, archivePath);
  } catch (error) {
    if (error.code !== "EXDEV") throw error;
    NodeFS.copyFileSync(sourceArchive, archivePath);
  }
  NodeFS.writeFileSync(`${archivePath}.sha256`, `${hash.digest("hex")}  ${name}\n`);
  console.log(archivePath);
} finally {
  restoreBrand?.();
  NodeFS.rmSync(temp, { recursive: true, force: true });
}
