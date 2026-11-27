# Work layout consistency (2026-11-27)

Owner, 2026-11-27, testing desktop main `73b0ba1a` with Work 0.1.19: "Work screen UI layout - better, but not
quite consistent with the rest of the screens yet. The search bar for example; the settings gear at the
bottom is on the left instead of right etc. … full consistency audit so we have consistent layout across
screens, to the point that when users navigate between screens, some elements don't even change."

The audit is atum-desktop PR #147 (`feat/consistency-audit-1127`, `docs/consistency-audit-1127.md`). It fixed
the desktop side and listed five Work items (rows 8, 9, 10, 13 and the accent check). This branch,
`feat/atum-layout-consistency` on `feat/work-runtime-0.1.16`, does those five. Everything is gated on the
Atum build (`VITE_ATUM_WORK_BUILD`); the upstream build is unchanged.

## Why the installed app still looked like stock T3

The 11-26 lane (`docs/work-ui-land-1126.md`) did the filled search, the hidden pencil and the right-aligned
gear as CSS inside the fork's theme file. Since the 11-24 decision (option B), desktop ships its own
colours-only palette (`atum-desktop/packages/atum-kit/dist/atum-t3-theme.json` as `atum.json`) and no CSS block,
so none of that CSS reaches the installed app. The fix here is in the components, not in theme CSS.

The blue buttons and near-black dark panels: T3 maps `--primary`, `--background` and the rest to the theme only
under `html[data-theme-id]`. The installed home does have the Atum theme published and set
(`defaultTheme: atum`, same digest as the shipped file), and the view's storage has adopted it. But until the
environment's copy reaches the page (first run, the Welcome step, a dropped connection, a fresh view
partition), no theme resolves and T3 paints stock: `oklch(48.8% .217 264)` buttons and `#000` dark. The audit's
capture had a failed WebSocket and showed exactly that; with a working connection the same runtime renders
Atum's colours.

## Changes

| Item                    | Change                                                                                                                                                                                                                                                                                                                                                  | Where                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 1. Search (audit row 8) | The left panel's search in the Atum build is the Kit field desktop's `MatrixPanelSearch` draws: 32 px, 8 px radius, 14 px text, 16 px magnifier, filled with the palette's `sidebarControlSurface` (that is the Kit's quiet fill laid on the panel: `rgba(23,25,31,.055)` on `#f7f8f9` = `#ebeced`, `rgba(255,255,255,.065)` on `#1c1d20` = `#2b2c2e`). | `apps/web/src/components/sidebar/SidebarThreadHeader.tsx`                                        |
| 2. Plus menu (row 9)    | T3's pencil becomes a plus menu: New thread (with its shortcut), New thread in a worktree, Add project. Each runs the same `runAtumBandCommand` the desktop band ran. In Work mode the folder filter is hidden (one folder; Code mode keeps it).                                                                                                        | same file, `AtumNewMenu`                                                                         |
| 3. Gear (row 10)        | The foot's Settings gear is last, on the right. Pull requests and Issues stay on the left.                                                                                                                                                                                                                                                              | `apps/web/src/components/sidebar/SidebarChrome.tsx`                                              |
| 4. Open thread (row 13) | The existing sidebar report (`window.atumWork.reportSidebar`) carries `thread: { title, repo?, branch? } \| null`. ChatView offers it (like the right panel); `repo` is the project's name, `branch` the checkout branch.                                                                                                                               | `apps/web/src/atum/openThread.ts`, `SidebarReport.tsx`, `ChatView.tsx`                           |
| 5. Palette              | The Atum build bundles the palette (`atum-work/theme/atum.json`, now the desktop's file byte for byte) and `applyThemePalette` paints it whenever no theme resolves. A resolved theme (the published copy, or one the person picks) still wins. The pre-mount splash uses the same colours via brand rules on `index.html`.                             | `apps/web/src/atum/atumPalette.ts`, `apps/web/src/themePalette.ts`, `atum-work/brand.rules.json` |

`scripts/atum-work/theme.mjs` now copies the Kit's T3 theme file instead of generating a theme with CSS.

## Desktop follow-ups (atum-desktop)

1. Once a runtime from this branch is pinned, remove `WorkRosterControls` (the title band's +): New lives in
   the view's plus menu.
2. Extend `parseWorkSidebar` / `WorkSidebarSnapshot` (`apps/desktop/shared/matrix-work.ts`) with the optional
   `thread` and show "name · repo · branch" in zone B (`app/work/work-band.tsx`, `WorkTitle`). Older runtimes
   send no `thread`; keep "Work" then.
3. Not in this branch, also lost with the theme CSS: Work-mode thread rows read as Chat's (title and time,
   no folder chip), the composer overlay starting below the provider banner, the alert tint. Each needs its
   own component change in the fork.

## Verification (2026-11-27, Asia/Ho_Chi_Minh)

| Check     | Command                                                                                                                         | Result                                                                                                                                                                              |
| --------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| typecheck | `vp run typecheck` in `apps/web`                                                                                                | rc 0, 0 errors                                                                                                                                                                      |
| lint      | `vp lint <changed .ts/.tsx/.mjs>`                                                                                               | rc 0                                                                                                                                                                                |
| format    | `vp fmt --check <changed files>`                                                                                                | clean (`brand.rules.json` was unformatted on base; now formatted)                                                                                                                   |
| unit      | `vp test run --project unit src/atum src/themePalette.test.ts src/themeBoot.test.ts src/hooks`                                  | 24 files, 208 passed                                                                                                                                                                |
| browser   | `vp test run --project browser src/atum/SidebarReport.browser.test.tsx src/themePalette.browser.test.ts src/components/sidebar` | 14 files, 57 passed                                                                                                                                                                 |
| wider     | `Sidebar.browser`, `Sidebar.shortcuts.browser`, `ChatView.browser`; `reactCompilerCoverage`, `ChatView.logic`                   | 1 ChatView browser test timed out under load and passes alone; `reactCompilerCoverage` fails on `routes/__root.tsx` (logical assignment bailout), a file this branch does not touch |
| brand     | `brand-map.mjs`, `brand.mjs --check`, `node --test scripts/atum-work/brand.test.mjs`                                            | regenerated (5 splash entries), check rc 0, 1/1 pass                                                                                                                                |
| secrets   | `gitleaks git --log-opts=origin/feat/work-runtime-0.1.16..HEAD --redact`                                                        | no leaks                                                                                                                                                                            |
| knip hook | pre-commit `knip:check`                                                                                                         | skipped: red on base (11 unused files, none from this branch)                                                                                                                       |

Live: the installed 0.1.19 runtime (before) and the same binary with this branch's Atum client (after), served
with `t3 serve`, light and dark: `~/.atum/operations/evidence/work-consistency-1127/` (README there).
Measured after: search 32 px at the panel's 8 px gutter, 8 px radius, 14 px, filled; plus menu with the three
items; gear at the foot's right edge; the report's `thread` = `{title, repo, branch}`; with no theme yet,
`data-theme-id=atum` and the ink accent instead of stock blue and `#000`.
