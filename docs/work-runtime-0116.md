# Work runtime 0.1.16 — 2026-11-25

Local-only assembly, built-not-live. Base origin/feat/native-t3-bridge-t2-1124
554a2d1166 includes runtime 0.1.15. Kit sync 94c2dcf36f merges cleanly;
both additions in workSubmitAccess.ts are retained by Git's automatic merge.
Use the existing scripts/atum-work/build.mjs and smoke.mjs release path,
with exact Node 26.13.1 and locked Rust monitor as in 0.1.15. Stamp the
workflow dispatch and fallback versions 0.1.16; upstream package versions stay
0.1.11 and are overridden by the native packer's runtime version argument.
No push, PR, CI, cloud, release, installed state or provider auth operations.

Archive: `release-build-inputs/work-0.1.16/atum-work-0.1.16-darwin-arm64.tar.gz`,
151353995 bytes. SHA256 `9676430dc8e500a52d5e93beb2cdb3aed468834c6da35f159c3ef993a3f4e58b`.
Standard packer uses local ad-hoc executable signatures; no signing credentials
or notarization. Exact Node download verified against official SHASUMS256.txt.

Assembly exposed stale brand counts and new unmapped upstream icons. Regenerated
the brand map from rules, made the generator preserve the existing instruction
default and boot spinner, and mapped seven imported icons to bundled Kit glyphs.
The old generator silently dropped both manually maintained fields. Fixed the
pre-existing provider-visibility test's weak object union type and made the native
registry test use deterministic time and required namespace imports. New native
Connect and Kit command tests cover assertion pass-through, invalid identities,
native command routing and bridge cleanup.

| Local check | Exit | Evidence |
| --- | ---: | --- |
| Locked filtered dependency install | 0 | pnpm 12.14.0, existing shared store |
| Standard archive build | 0 | Node 26.13.1, Rust 1.100.0, locked monitor |
| Packaged smoke | 0 | isolated HOME, loopback pairing, exact orientation, all startup phases |
| Native bridge + brand regression | 0 | 4 tests, ATUM_WORK_MAC_ID=mac fixture |
| Server connector + transport | 0 | 6 tests |
| Web unit, Connect identity + Kit commands | 0 | 25 tests across 8 files |
| Web browser submit + picker | 0 | 3 tests across 2 files |
| Unbranded web / server typecheck | 0 / 0 | effect-tsgo tsrs --noEmit |
| Branded web / shared / client-runtime / contracts / server typecheck | 0 / 0 / 0 / 0 / 0 | real temporary brand pass, restored afterwards |
| Focused lint | 0 | web Atum/Clerk/submit, server Atum, relay, generator |
| Brand map check | 0 | exact counts and provider identity anchors |
| git diff --check | 0 | source whitespace |

Earlier attempts: native test without fixture Mac ID exited 1; rerun with
the documented binding fixture passed. Web typecheck initially exited 2 due to
the existing provider visibility test (fixed). Focused lint initially exited 1
on native registry test imports/time (fixed). Lint during the temporary branded
build exited 1 on four translated-copy rules; the final restored source passes.
Build initially exited 1 on stale brand counts, then 1 on missing icon mapping;
both fixed before the successful archive. An install invoked before pnpm had
finished provisioning exited 127; the final locked install passed. Upstream tag
was absent initially (ancestry check exit 128); fetched v0.1.11 and built normally.

Dependencies, temporary toolchain, native target, and build outputs are removed
after handoff checks; archive and checksum remain. No installed/native cloud
end-to-end acceptance is claimed: this is a local, built-not-live release input.
