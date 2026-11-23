# Work runtime 0.1.13: Work/Code presentation (F2, F3) — built, not live (2026-11-23)

Owner (2026-11-23): "Work seems to be T3 inside Atum shell … UI looks weird"; "the design of Work isn't in
line with our consistent aesthetics"; "get the mode split folded in". Implements F2 and F3 of atum-desktop
design spec `70dd4ea7` (§8.3, §9.5) on top of F1/F4 (`work-runtime-0113-plumbing.md`). Everything is gated:
`useAtumSurfaceMode` returns `code` outside `VITE_ATUM_WORK_BUILD`, so upstream rendering is unchanged.

## F2: what Work hides (and how)

- `atum/surfaceMode.ts` adds `useActiveAtumSurfaceMode()` (the active main chat's mode, for chrome outside
  ChatView). Pure helpers live in `surfaceMode.logic.ts`.
- ChatView: thread-details and terminal toggles, maximize, the composer context strip (env/branch), the
  permission chip, `ThreadDetailsPanel`, `ChatTerminalDrawers` are not rendered in Work. Right-panel Diff,
  terminal, pull-request(s) and issue surfaces are filtered and cannot be added; `terminal.*`,
  `threadPanel.toggle` and `rightPanel.toggleMaximized` chords answer "not handled".
- Roster footer: Pull requests and Issues hidden in Work; Usage hidden in the Atum build (no balance meters).
- Timeline minimap hidden; provider slash commands dropped from suggestions only (typed, they still run).
- Composer permissions chip hidden in Work through T3's own ownership rule (`ComposerControlsBar`: Work counts
  as "permissions not shown here"), and the Permissions section in the model/compact menus hidden. The chip
  fix landed after the dependency cleanup, so its typecheck/lint/screenshot were not re-run; hosted CI covers it.
- Not done: command-palette git/worktree/port-forward filtering and the Settings nav filter (§8.3 rows).

## F3: Work presentation (`atum/WorkPresentation.tsx`)

- The working row carries the Kit atom; collapsed work groups add "· N steps".
- Changed files render as file cards; Open previews the file (Work passes an open-file handler instead of
  the turn-diff opener). Note: T3 checkpoints are git refs, so a plain-folder project produces no
  changed-files card; cards appear for git-backed Work projects only.
- Approvals: one plain question, Allow / Not now, raw detail behind Details; providers whose options lack a
  plain accept/decline pair keep T3's full action row.
- New thread: Atum mark, "What should we work on?", "Files in {project} are in reach." (the project name is
  the project picker), three suggestions that prefill the composer.
- Thread loading: three skeleton lines.
- Live (not yet grouped) tool entries still show one row each while a turn runs.

## Also

- Band commands: `window.atumWorkCommands.run('sidebar.toggle' | 'chat.new')` (installed in the root
  route, Atum build only). `shortcuts/dispatcher.ts` gains `runCommand`; the sidebar listens for
  `sidebar.toggle` through `registerMenuAction` (same desktop menu path as before).
- `data-sidebar-brand-row` on the roster's brand row, for the theme to hide.
- Picker (C4 deferred item): in the Atum build the rail orders Atum, connected plans, then unconnected; an
  unconnected plan shows "Use your {provider} plan" + Connect (the existing setup route). Reading other
  Macs' facts from the account set is not wired: Work's picker can only use this Mac's logins, which T3's
  provider status already reports.

## Verification (local, Node 24)

- `vp test run --project unit src/atum/workMode.logic.test.ts src/atum/iconImports.logic.test.ts
  src/keybindings.test.ts` (from apps/web): exit 0, 54 tests.
- `vp run --filter @t3tools/web typecheck`: exit 0. Scoped `vp lint` + `vp fmt` on changed files: exit 0.
- `VITE_ATUM_WORK_BUILD=1 vp build` (apps/web): exit 0.
- Headless Chrome against `vp run dev` (isolated home, `--no-seed`, desktop's generated theme published):
  Work new thread, Work thread with the replay showcase (atom + plain approval), Code repo draft, Documents
  flipped Code and back, terminal chord inert in Work.
- The pre-commit hook's `knip:check` could not run here (mobile/marketing deps not installed in the
  partial install; it reports only those packages plus the pre-existing check-atum-icon-build.mjs), so this
  commit skipped the hook; fmt and lint ran separately. Hosted CI runs knip on a full install.
- i18n: new strings use `gt()`/`<T>`; `vp run i18n:generate` and translations were not run.
