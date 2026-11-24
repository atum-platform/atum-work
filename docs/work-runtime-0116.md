# Work runtime 0.1.16 — 2026-11-25

Local-only assembly, built-not-live. Base origin/feat/native-t3-bridge-t2-1124
554a2d1166 includes runtime 0.1.15. Kit sync 94c2dcf36f merges cleanly;
both additions in workSubmitAccess.ts are retained by Git's automatic merge.
Use the existing scripts/atum-work/build.mjs and smoke.mjs release path,
with exact Node 26.13.1 and locked Rust monitor as in 0.1.15. Stamp the
workflow dispatch and fallback versions 0.1.16; upstream package versions stay
0.1.11 and are overridden by the native packer's runtime version argument.
No push, PR, CI, cloud, release, installed state or provider auth operations.
