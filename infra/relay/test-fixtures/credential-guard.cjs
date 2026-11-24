const fs = require("node:fs"),
  path = require("node:path"),
  url = require("node:url");
const userHome = require("node:os").homedir();
const denied = [userHome + "/.codex", userHome + "/.claude", userHome + "/Library/Keychains"];
function forbidden(p) {
  try {
    p = p instanceof URL ? url.fileURLToPath(p) : String(p);
    p = path.resolve(p);
    return denied.some((d) => p === d || p.startsWith(d + "/"));
  } catch {
    return false;
  }
}
function error() {
  return Object.assign(new Error("test credential boundary"), { code: "EACCES" });
}
for (const key of [
  "readFileSync",
  "openSync",
  "readdirSync",
  "statSync",
  "lstatSync",
  "accessSync",
  "realpathSync",
]) {
  const original = fs[key];
  fs[key] = function (p, ...args) {
    if (forbidden(p)) throw error();
    return original.call(this, p, ...args);
  };
}
for (const key of ["readFile", "open", "readdir", "stat", "lstat", "access", "realpath"]) {
  const original = fs[key];
  fs[key] = function (p, ...args) {
    if (forbidden(p)) {
      const cb = args.at(-1);
      if (typeof cb === "function") {
        queueMicrotask(() => cb(error()));
        return;
      }
      throw error();
    }
    return original.call(this, p, ...args);
  };
  const promise = fs.promises[key];
  if (promise)
    fs.promises[key] = async function (p, ...args) {
      if (forbidden(p)) throw error();
      return promise.call(this, p, ...args);
    };
}
const cp = require("node:child_process");
for (const k of ["spawn", "spawnSync", "execFile", "execFileSync"]) {
  const orig = cp[k];
  cp[k] = function (file, ...args) {
    if (/(?:codex|claude|security|osascript)(?:\s|$)/i.test(file)) throw error();
    return orig.call(this, file, ...args);
  };
}
require("node:module").syncBuiltinESMExports();
