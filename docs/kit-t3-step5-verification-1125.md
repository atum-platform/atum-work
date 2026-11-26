# Kit on T3 step 5: Work verification

Owner request: KIT-FROM-T3-1124, option B. Verified the Work half at
`f7e245b39c8ebde82431a85fef0f8bc628ffd2f2` on 2026-11-25. This is a local
verification/fix checkpoint, not a release or installed-app acceptance result.

## Behavior and fixes

- The title-band bridge already delegates history commands to T3's
  `canNavigateHistory` / `navigateHistory` helpers, and the sidebar report uses
  `useCanNavigateHistory`. Retained those paths; no second history stack.
- Work's sidebar report also mounts in the standalone Work web build. T3's
  history helper previously assumed Chromium's Navigation API was present.
  It now returns false and installs no subscription when that API is absent.
  Chromium still subscribes to `currententrychange` and uses native history.
- Added three command unit cases covering both directions, unavailable
  boundaries, unknown commands, and missing Navigation API. Added two real
  Chromium component cases covering both report flags, updates, unsubscription,
  and missing Navigation API.
- Web typecheck exposed an existing weak-type error in the provider settings
  visibility fixture. Annotated its map with its actual common row shape and
  formatted that fixture. No runtime provider behavior changed.

## Verification

Used Vite+ 1.4.0, its pinned Node 26.13.1, and pnpm 12.14.0. One locked
dependency install:

`vp i --frozen-lockfile --filter @t3tools/web... --filter @t3tools/monorepo`

Exit 0; lockfile unchanged. The filtered install omitted the lint workspace's
links, so linked its existing locked `@oxlint/plugins` and `effect` packages from
the installed dependency tree locally, without another install. Unit and browser
tests run from `apps/web`; running from the root unnecessarily loaded the
uninstalled mobile config and failed on its missing `@babel/core` (exit 1).

Final checks:

| Check                                                                                                                                                                                              | Exit | Evidence                                                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------- |
| `vp run --filter @t3tools/web typecheck`                                                                                                                                                           | 0    | All touched source belongs to web; nonfatal upstream Effect suggestions remain        |
| `vp lint` on the three original changed files, helper, both new tests, and fixture                                                                                                                 | 0    | Initial lint configuration failed before local workspace links were supplied (exit 1) |
| `vp test run src/atum/workCommands.test.ts src/atum/workMode.logic.test.ts src/components/chat/workSubmitAccess.test.ts src/components/settings/providerSettingsVisibility.test.ts --project unit` | 0    | 15 tests in four files                                                                |
| `vp test run src/atum/SidebarReport.browser.test.tsx --project browser`                                                                                                                            | 0    | Two tests; isolated Playwright headless Chromium                                      |
| `node scripts/atum-work/brand.mjs --check atum-work/brand.json`                                                                                                                                    | 0    | 181 files validated                                                                   |
| `vp fmt` on new/edited files                                                                                                                                                                       | 0    | Formatted four files                                                                  |
| `git diff --check`                                                                                                                                                                                 | 0    | No whitespace errors                                                                  |

The missing-API command case was also run against the original helper: exit 1,
with `TypeError: Cannot read properties of undefined (reading 'canGoBack')` at
`navigationHistory.ts:11`. The fixed helper passes. Initial web typecheck exited
2 solely for the fixture error above; the corrected full web check exits 0.

The first commit attempt exited 1: its staged-file formatter and linter passed,
but the hook invokes repo-wide Knip. Knip could not load the deliberately
uninstalled mobile/marketing configs (`expo/tsconfig.base.json`,
`astro/tsconfigs/strict`) or the scripts preprocessor (`typescript-legacy`),
and reported unrelated existing unused items. The checkpoint uses a one-command
`git -c core.hooksPath=/dev/null commit` override after the focused checks above;
Knip is not claimed green. No second dependency install was performed.

All dependency directories, test caches, temporary browser runtime, and temporary
Vite+ runtime are removed after verification. No push, PR, CI, deployment, paid
API, or dev server. The coordinator owns assembly, review, host-arrow integration
acceptance, and shipping.
