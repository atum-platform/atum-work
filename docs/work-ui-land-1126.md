# Work UI land: matching Chat (2026-11-26)

Owner, 2026-11-26: "i see the Work UI is still ugly as before? Not done yet? already requested it?"
The 11-25 fixes (Kit step 5 and the two-card panel layout) sat on unmerged branches, so the installed
app (0.20.55, runtime 0.1.16) still showed the old look. This branch assembles them on the branded
release branch and fixes what still differed from Chat when the two were compared side by side.

Assembly: `feat/work-ui-land-1126` = `origin/feat/work-runtime-0.1.16` + `feat/work-panel-layout-sync-1125`
(which contains `feat/kit-t3-sync-step5-1125`). The only conflicts were two test files; both sides kept
(`apps/web/src/atum/workCommands.test.ts` now has the band, history and right-panel cases).
Paired host branch: atum-desktop `feat/work-ui-land-1126`.

## What still differed after the merge, and the fix

All fixes are CSS in the Atum environment theme (`scripts/atum-work/theme.mjs` -> `atum-work/theme/atum.json`),
which desktop main publishes with `theme set`. No upstream source file changed, so the fork stays mergeable.
Work-mode rules are scoped to `:root[data-atum-mode="work"]`, which `atum/surfaceMode.ts` already sets.

| Seen                                                                                                              | Fix                                                                                                                                           |
| ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| The provider-status notice covered the empty thread's greeting mark ("What should we work on?")                   | The banner lane is a CSS anchor; the composer overlay starts at its bottom. An empty lane has zero height, so nothing moves without a notice. |
| The list's search was bare text; Chat's roster has a filled search field                                          | Filled with the sidebar control surface and Kit's small radius.                                                                               |
| A pencil "New thread" in the list that seemed to do nothing (owner, 11-24): on an empty draft T3 reuses the draft | Hidden. The host title bar's + menu owns new thread (and focuses the composer on a reused draft).                                             |
| Folder chips ("WE workspace") on every row, a folder filter, and a folder crumb, all naming the one Work folder   | Hidden in Work mode. Rows read as Chat's: title and time, then where the thread runs. Code mode keeps them.                                   |
| Settings gear at the foot's left; Chat's sits at the right                                                        | Right-aligned in Work mode (it is the only footer item there).                                                                                |

Already fixed on the release branch before this work (230c485749, 11-24) but not yet in the installed
runtime: the instance-initials overlay on every model-picker logo, Atum's tiled provider mark, Kit switch
proportions. The owner sees them once a runtime built from this branch ships.

## Remaining gaps (not done here, with reasons)

- The thread title ("New thread") sits inside the main card; Chat puts the conversation title on the title
  bar. Moving it needs the view to report the title to the host band (a new report field and host UI), a
  separate slice.
- Settings is T3's full settings dialog, including Code-only sections, and is denser than Chat's settings.
  Trimming it is a product decision about which T3 settings Work keeps.
- The model picker is being extracted by another lane (`feat/shared-model-picker`); not touched here.

## Verification

Live: the dev web UI (`VITE_ATUM_WORK_BUILD=1`, Atum theme set, decoy Codex home) inside the desktop
playground's Work host (`matrix-playground.html?evidence=1&work=ready&workView=<url>`), 1440x900, light and
dark. Evidence: `~/.atum/operations/evidence/work-ui-1126/` (`before/`, `after/`).

Checks: `node --test scripts/atum-work/brand.test.mjs` pass; `brand-map.mjs` + `git diff --exit-code
atum-work/brand.json` clean; `brand.mjs --check` 190 files; `vp run --filter t3 --filter @t3tools/web --filter
@t3tools/scripts typecheck` 0; the workflow's scoped `vp lint` list plus the two merged test files 0;
`vp test run --project unit src/atum ...` 37 passed; `vp test run --project browser` SidebarReport +
workSubmitAccess 4 passed. Not run: `scripts/atum-work/replay.sh` (fetches upstream tags into a disposable
worktree; disk was under 4 GiB and the replay is red on the branded base itself) and the server tests in the
workflow (no server file changed; they fail under linked deps, see the prepush README).
