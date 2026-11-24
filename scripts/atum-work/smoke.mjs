import * as NodeAssert from "node:assert/strict";
import * as NodeChildProcess from "node:child_process";
import * as NodeEvents from "node:events";
import * as NodeFS from "node:fs";
import * as NodeModule from "node:module";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeReadline from "node:readline";
import * as NodeTimersPromises from "node:timers/promises";

const [archive, expectedName] = process.argv.slice(2);
NodeAssert.ok(
  archive && expectedName,
  "Usage: node scripts/atum-work/smoke.mjs <archive> <display-name>",
);
const requireWeb = NodeModule.createRequire(
  new URL("../../apps/web/package.json", import.meta.url),
);
const { chromium } = requireWeb("playwright");
const temp = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "atum-work-smoke-"));
let browser;
let child;
let exit;
try {
  NodeChildProcess.execFileSync("/usr/bin/tar", ["-xzf", NodePath.resolve(archive), "-C", temp]);
  const [name, ...rest] = NodeFS.readdirSync(temp);
  NodeAssert.ok(name && rest.length === 0, "Expected one runtime root");
  const root = NodePath.join(temp, name);
  const json = (file) => JSON.parse(NodeFS.readFileSync(NodePath.join(root, file), "utf8"));
  NodeAssert.match(
    NodeFS.readFileSync(NodePath.join(root, "LICENSE"), "utf8"),
    /Copyright \(c\) 2026 T3 Tools Inc\./,
  );
  NodeAssert.match(
    NodeFS.readFileSync(NodePath.join(root, "licenses", "Node-LICENSE"), "utf8"),
    /Node\.js/,
  );
  NodeAssert.ok(json("licenses/runtime-npm.json").entries.length > 0);
  NodeAssert.ok(json("licenses/resource-monitor/inventory.json").length > 0);
  NodeAssert.ok(json("client/third-party-licenses.json").entries.length > 0);

  const executable = NodePath.join(root, "t3");
  const monitor = NodePath.join(root, "resource-monitor", "t3-resource-monitor");
  for (const binary of [executable, monitor]) {
    NodeAssert.match(
      NodeChildProcess.execFileSync("/usr/bin/file", [binary], { encoding: "utf8" }),
      /arm64/,
    );
  }
  NodeChildProcess.execFileSync("/usr/bin/codesign", ["--verify", executable]);
  NodeChildProcess.execFileSync("/usr/bin/codesign", ["--verify", monitor]);
  const cwd = NodePath.join(temp, "workspace");
  const home = NodePath.join(temp, "home");
  NodeFS.mkdirSync(cwd);
  NodeFS.mkdirSync(home);
  const env = { PATH: "/usr/bin:/bin", HOME: home, T3CODE_HOME: NodePath.join(home, ".work") };
  const version = NodeChildProcess.execFileSync(executable, ["--version"], {
    cwd,
    env,
    encoding: "utf8",
  });
  NodeAssert.match(version, /\bv\d+\.\d+\.\d+\b/);
  child = NodeChildProcess.spawn(
    executable,
    ["--mode", "web", "--no-browser", "--host", "127.0.0.1"],
    {
      cwd,
      env,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  exit = NodeEvents.once(child, "close");
  let stdoutGrants = 0;
  let stderr = "";
  const stdoutForwarded = [];
  child.stderr.setEncoding("utf8").on("data", (chunk) => {
    stderr += chunk;
  });
  const stdout = NodeReadline.createInterface({ input: child.stdout });
  let acceptPairingUrl;
  const seen = new Promise((accept) => {
    acceptPairingUrl = accept;
  });
  stdout.on("line", (line) => {
    const pairing =
      /^\s*pairingUrl:\s*(http:\/\/127\.0\.0\.1:\d+\/pair#token=[A-Za-z0-9_-]+)\s*$/.exec(line);
    if (pairing) {
      stdoutGrants++;
      acceptPairingUrl(pairing[1]);
      return;
    }
    stdoutForwarded.push(line);
  });
  const pairingUrl = await Promise.race([
    seen,
    exit.then(() => null),
    NodeTimersPromises.setTimeout(25_000, null, { ref: false }),
  ]);
  NodeAssert.ok(pairingUrl, "Packaged server did not provide a startup grant");
  const { origin, hash } = new URL(pairingUrl);

  browser = await chromium.launch();
  const page = await browser.newPage();
  await page.addInitScript(() => {
    window.__atumSmokeStartupPhases = [];
    window.atumWork = {
      reportSidebar: async () => {},
      reportStartupPhase: async (phase) => {
        window.__atumSmokeStartupPhases.push(phase);
      },
    };
  });
  await page.route("**/*", (route) =>
    new URL(route.request().url()).origin === origin ? route.continue() : route.abort(),
  );
  try {
    await page.goto(pairingUrl, { timeout: 15_000 });
  } catch {
    throw new Error("Could not load the packaged pairing view");
  }
  await page
    .waitForFunction(
      async () => {
        const session = await fetch("/api/auth/session").then((response) => response.json());
        return session.authenticated === true && !window.location.hash;
      },
      undefined,
      { timeout: 15_000 },
    )
    .catch(() => {
      throw new Error("Packaged view did not pair");
    });
  await page.waitForSelector('[data-slot="sidebar"]', { state: "attached", timeout: 15_000 });
  NodeAssert.ok(new URL(page.url()).pathname !== "/welcome", "Fresh home showed onboarding");
  NodeAssert.ok(
    (await page.title()).includes(expectedName),
    "The document title did not use the brand map",
  );
  const expectedInstructions = NodeFS.readFileSync(
    new URL("../../docs/user/agent-instructions.txt", import.meta.url),
    "utf8",
  );
  const instructions = await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const socket = new WebSocket(
          `${location.origin.replace(/^http/, "ws")}/ws?orchestrationProtocol=2`,
        );
        const timeout = setTimeout(() => {
          socket.close();
          reject(new Error("Settings RPC timed out"));
        }, 10_000);
        socket.onopen = () =>
          socket.send(
            JSON.stringify({
              _tag: "Request",
              id: "atum-instructions-smoke",
              tag: "server.getSettings",
              payload: {},
              headers: [],
            }),
          );
        socket.onmessage = ({ data }) => {
          const messages = JSON.parse(data);
          for (const message of Array.isArray(messages) ? messages : [messages]) {
            if (message._tag !== "Exit" || message.requestId !== "atum-instructions-smoke")
              continue;
            clearTimeout(timeout);
            socket.close();
            if (message.exit?._tag !== "Success") reject(new Error("Settings RPC failed"));
            else resolve(message.exit.value.agentInstructions);
          }
        };
        socket.onerror = () => {
          clearTimeout(timeout);
          reject(new Error("Settings RPC socket failed"));
        };
      }),
  );
  NodeAssert.equal(instructions, expectedInstructions, "Fresh packaged HOME lost Atum orientation");
  console.log("Fresh packaged HOME resolves automatic B1 orientation exactly.");
  await page.waitForFunction(
    () => ["ws-connected", "providers-ready", "threads-painted"].every(
      (phase) => window.__atumSmokeStartupPhases.includes(phase),
    ),
    undefined,
    { timeout: 15_000 },
  );
  const phases = await page.evaluate(() => window.__atumSmokeStartupPhases);
  NodeAssert.equal(new Set(phases).size, phases.length, "Startup phases repeated");
  console.log(`Packaged startup reports: ${phases.join(", ")}.`);
  const connectHelp = NodeChildProcess.execFileSync(executable, ["connect", "--help"], {
    cwd,
    env,
    encoding: "utf8",
    timeout: 10_000,
  });
  NodeAssert.match(connectHelp, /unavailable in builds without public configuration/);
  NodeAssert.equal(stdoutGrants, 1);
  const token = new URLSearchParams(hash.slice(1)).get("token");
  NodeAssert.ok(
    token && !stdoutForwarded.some((line) => line.includes(token)) && !stderr.includes(token),
    "Pairing grant leaked outside the consumed stdout line",
  );
  console.log(
    "Packaged arm64 runtime paired on loopback, rendered its brand title, skipped Welcome, and kept Connect off.",
  );
} finally {
  await browser?.close();
  if (child?.pid && child.exitCode === null && child.signalCode === null) {
    child.kill("SIGTERM");
    const stopped = await Promise.race([
      exit.then(() => true),
      NodeTimersPromises.setTimeout(5_000, false, { ref: false }),
    ]);
    if (!stopped) {
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch (error) {
        if (error.code !== "ESRCH") console.error("Could not stop the smoke process group");
      }
      await exit;
    }
  }
  NodeFS.rmSync(temp, { recursive: true, force: true });
}
