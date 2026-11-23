# Work runtime 0.1.13 plumbing — built, not live (2026-11-23)

Owner requests: “the design of Work isn't in line with our consistent aesthetics - icon uses for example”; “get the mode split folded in”. This implements the K1/F4/F1/E8 plumbing slice of atum-desktop design spec `70dd4ea701f236992abba5b069dc41beddcfc890`, sections 8, 9 and 11. UI guards/presentation, assembly review, runtime pin/version and shipping remain with the coordinator. No push, CI, archive, deployment or nested delegation was performed.

Native inventory: project override inheritance is `packages/contracts/src/settings.ts` plus `packages/shared/src/projectSettings.ts`; project creation/bootstrap is `apps/server/src/project/ProjectService.ts`; shortcuts use `packages/shared/src/keybindings.ts` and the web shortcut resolver. No parallel preference store or new RPC was added.

## F1

`atumSurfaceMode` is a project-scoped Work/Code setting, inheriting the server's Work default when absent. Creation detects git working-copy membership with the existing ProcessRunner and Git, including nested paths and linked worktrees; detection failure uses Work. Seed happens only without an existing project override, so provisioners can explicitly select Work and owner choices survive idempotent creation. Existing pre-upgrade projects inherit the server default until changed; no historical project migration is performed.

`useAtumSurfaceMode(projectId, environmentId?)` returns Code outside the Atum build. The active main ChatView owns the document root attribute and `window.atumSurfaceMode` adapter; embedded/background chats cannot replace it. The root defaults to Work before a project mounts. Mode changes use the native permission-checked settings command and do not touch thread/model/history state.

`atum.mode.toggle` is registered on Cmd/Ctrl+Shift+M with the native `atumWorkBuild` condition. This chord already opens T3's model picker: the later Atum-only binding takes precedence there; upstream clients retain the model-picker chord. Saved user bindings retain native ordering.

## F4

The approved 245-row map and vendored Kit Light/Fill paths generate both Lucide export forms. The exact `lucide-react` alias is enabled only by `VITE_ATUM_WORK_BUILD=1`; real Lucide remains the fallback via its module path. Custom project icons import the real module directly so their saved glyphs remain content. Mirroring and map weight are supported. SVG min dimensions are 16 px even for Tailwind sizes; LoaderCircle carries the Kit spinner hook.

Run `node apps/web/scripts/build-atum-icons.mjs` after copying `atum-desktop/packages/atum-kit/dist/phosphor-icons.json` to `apps/web/src/atum/phosphor-icons.json`. The Atum Vite plugin regenerates the shim, scans production named imports/re-exports and rejects unmapped names or namespace/default/dynamic imports. Tests and the intentional custom-icon resolver are excluded. Phosphor's MIT notice is retained alongside the paths.

## Desktop seam (E8)

The band's API is `window.atumMatrix.work.getSurfaceMode()`, `setSurfaceMode(projectId, mode)`, and `onSurfaceModeChanged(listener)`. It returns `{projectId, mode}` or null. Desktop main invokes the active Work page adapter, which persists through native settings. A stale project id is rejected by the page. Owner-page preload reports changes through authenticated, top-frame/current-account checked IPC; navigation and account teardown clear the snapshot.

## Verification

- `PATH=/opt/homebrew/opt/node@24/bin:$PATH TMPDIR=<worktree>/.test-tmp vp test run apps/web/src/atum/iconImports.logic.test.ts apps/web/src/keybindings.test.ts packages/shared/src/projectSettings.test.ts packages/contracts/src/settings.test.ts apps/server/src/project/ProjectService.test.ts`: exit 0, 127 tests. Tests exercise native settings inheritance, repository seeding, retained choice, shortcut collision and unmapped imports.
- `vp run --filter @t3tools/web --filter t3 typecheck`: exit 0 (Effect suggestions remain).
- Scoped `vp lint` over the changed TS/TSX/MJS files: exit 0.
- `VITE_ATUM_WORK_BUILD=1 node apps/web/scripts/check-atum-icon-build.mjs`: exit 0; real build resolves alias, verifies Phosphor viewBox and floor, and rejects a newly unmapped name.
- Shell Node 23.10 cannot run native SQLite tests; installed Node 24 was used. No archive build.

One temporary pnpm store was created inside the parent worktree and removed after installation. Installed fork dependency directories and test scratch data were removed after verification to return disk space; no global store was modified.
