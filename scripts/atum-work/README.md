# Atum Work standalone runtime

The fork carries a linear queue over an upstream stable tag. Q1 is the generated brand
overlay, Q3 is the defaults, and Q6 is the composer access check. Q4 (Work/Code)
and Q5 (Vietnamese) are reserved for a later slice. The five-seam cap includes those
reserved entries. The tooling and workflow carry no additional product seams.

## Replay the queue

```sh
scripts/atum-work/replay.sh v0.1.10 v0.1.11 v0.1.11 HEAD
```

The arguments are previous pin, next pin, base of the carried queue, and queue head.
Supply an optional fifth argument with an absolute brand map path to validate it on both pins.
The script uses a disposable worktree, checks the two Codex identity anchors on
both pins, and compares the resulting tree with the source when replaying back
onto its base. After a bump, run the build, smoke and scoped tests again.

## Generate and build

Place the release map at `atum-work/brand.json` for the verification workflow.
The map has three fields:

- `strings` contains objects with `file` relative to `apps/web`, literal `from` and `to`
  strings, and an exact `count`. Replacements run in map order.
- `assets` contains objects with `file` relative to `apps/web`, a `source` relative
  to the map, and the exact `upstreamSha256` of the file being replaced.
- `icons` maps all six upstream web icon output filenames to replacement paths
  relative to the map. Upstream copies development icons during server assembly,
  so the Work build installs these overrides after that step.

`atum-work/brand.json` is generated. Edit `atum-work/brand.rules.json` (explicit entries, then
tokens that match only after a non-identifier character) and run
`node scripts/atum-work/brand-map.mjs`; after a pin bump, rerun it and review the count diff.
Tokens run over `apps/web`, `packages/shared` and `packages/client-runtime`. `packages/contracts`
takes explicit message-text entries only. Provider-facing identity stays upstream. The map also
limits the web locales to English (Vietnamese arrives with Q5), because rebranded English source
no longer matches the upstream catalogs' hashes.

Validate the map with `node scripts/atum-work/brand.mjs --check atum-work/brand.json`.
Before a release, typecheck web, shared, client-runtime, contracts and server with the map applied.

## Theme

`atum-work/theme/atum.json` is an upstream environment theme (light with a dark variant and a small
CSS block) generated from Atum Kit:
`node scripts/atum-work/theme.mjs <atum-desktop>/packages/atum-kit/tokens.json`. The provenance file
beside it records the Kit version and the tokens hash. Desktop main publishes and selects it once per
home with the bundled CLI, before the first start: `theme set <path>/atum.json` with the scoped
`T3CODE_HOME`. No fork patch is involved.
In a dedicated checkout on macOS arm64, install the locked web, server and scripts
dependencies using Vite+. Use the Node version specified in the root manifest,
the LICENSE from that verified official Node distribution, and a Rust toolchain.

```sh
node scripts/atum-work/build.mjs v0.1.11 atum-work/brand.json /path/to/Node/LICENSE /path/to/output
node apps/web/node_modules/playwright/cli.js install --only-shell chromium
node scripts/atum-work/smoke.mjs /path/to/output/atum-work-0.1.11-darwin-arm64.tar.gz "Atum Work"
```

The output uses upstream’s single executable and relocatable layout. It includes
the web client and its web/server dependency notices, the actual staged npm
packages, the resource monitor’s macOS dependency notices, the upstream MIT
license, and the embedded Node license. The pinned objc2 source revisions share the same notice and expose MIT as an
option. Their packages omit those files, so the build carries the [original notice](https://github.com/madsmtm/objc2/blob/7b1abfd750a2cacaea71d6a56ecfb83cb7de560b/LICENSE.md)
and the [upstream MIT text](https://api.github.com/repos/madsmtm/objc2/git/blobs/ce8c4c17fd88f6cf5f3720c08fa685434e3cbcbb).
The build rejects a new objc2 source revision until its notice is reviewed.

The build emits a SHA-256 sidecar.
The build uses ad-hoc signing; the embedding desktop app owns distribution signing.

## Desktop contracts

Start the bundled binary directly in loopback web mode with `--no-browser`, from
a dedicated empty working directory and a scoped home. Consume the one-time
`pairingUrl:` stdout line before log forwarding. Keep Connect unconfigured and
pass a controlled environment. The shipped web build skips automatic Welcome
onboarding, the server defaults analytics off, and storage cleanup keeps the
upstream default.

Desktop main owns update and rollback. The upstream launcher runs the child in
`serve` mode with stdout and stderr directed to its log and can restart the
restored pin immediately. Main preserves the upstream prepared/committed trial
boundary and finishes auth reset before launching on a restored home.

Provision the managed ACP provider with instance ID `atum-managed`, and set
`textGenerationModelSelection` to it. Upstream's default title model is the `codex` instance, and
the server runs a `codex` CLI it finds (for example `/opt/homebrew/bin/codex`) even with that
instance disabled and PATH narrowed, which would send titles to the person's ChatGPT plan. The sandboxed
owner view's preload exposes `window.atumWork.readModelAccess()`, a zero-argument
read through desktop main to the managed-model proxy. Return `allowed`, `empty`,
or `unavailable`. Main owns the caller's account and origin validation and bounds
the IPC call. No proxy credentials or URLs cross into the view. A refused or failed
check keeps the draft and skips dispatch. The proxy's own metering decision also
covers races after the read.

## Protected Work question replies

For a protected or unknown Matrix answer, Desktop main checks the existing
protected model route, then calls this server with a one-time challenge
registered by the in-flight native MCP invocation. The callback reads the
current thread shell, active run and live MCP registry under the native thread
command lock. It succeeds only for the Desktop-provisioned, policy-locked
owner ACP instance. Ordinary provider names cannot grant release.

The callback syncs a content-free per-thread marker in an account directory
beside the T3 server home. The file persists across server restarts and home
rollback. Provider switch, session open and queued turn start check the
marker. Native fork/merge, guest sharing and MCP transcript reads refuse
protected context, and automatic title generation skips it. Hermes handles
summary requests on the same protected proxy route. Once any thread has a
marker, the Desktop proxy routes both managed Work gateways to the
protected model. This deliberately favors keeping Work's managed transcript
on the same route over keeping unrelated Work model choices on their prior
route. Subscription threads still run on their own providers.

Native seams used here include `apps/server/src/mcp/threadAccess.ts:147` and `:206`,
`apps/server/src/mcp/McpSessionRegistry.ts:167`,
`packages/shared/src/KeyedLock.ts:50`, and
`apps/server/src/policy/ManagedPolicy.ts:80` and `:174`. The direct transcript
fence does not isolate the files or process space of trusted same-user
applications.
