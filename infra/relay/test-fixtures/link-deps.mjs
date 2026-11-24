import { readdir, readFile, symlink } from "node:fs/promises";
const [repo, deps] = process.argv.slice(2);
for (const dir of await readdir(repo + "/packages")) {
  const path = repo + "/packages/" + dir;
  try {
    const { name } = JSON.parse(await readFile(path + "/package.json", "utf8"));
    if (name?.startsWith("@t3tools/")) await symlink(path, deps + "/node_modules/" + name);
  } catch (error) {
    if (!["ENOENT", "EEXIST"].includes(error.code)) throw error;
  }
}
