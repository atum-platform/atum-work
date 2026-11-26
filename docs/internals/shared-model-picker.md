# Shared model picker

Atum's desktop chat is intended to use the same provider and model picker as Work. The source stays in
`apps/web/src/components/chat`, where upstream T3 maintains it. Atum adds one host seam and one
export entry next to it, so upstream merges touch the same files they always did.

Plan of record: atum-app `docs/plans/2026-11-26-native-provider-picker.md`, slice 1, Work side.

## Spike decision (2026-11-26)

**Decision: option (a), a library entry built by Work's Vite and shipped in the pinned Work
runtime. It is clean only after a small host seam.** Option (b), a source package, is rejected:
the picker's dependencies are not small. They include `gt-react`, Base UI, LegendList,
`lucide-react`, `class-variance-authority`, `tailwind-merge`, Effect, and the `@t3tools/contracts`,
`shared` and `client-runtime` packages. A source package would put all of them into Desktop's
npm tree. The plan rules that out.

### The closure as it stands

The closure is measured by following the runtime (non-type) imports from
`ProviderModelPicker.tsx` and `ComposerModelEffort.tsx`. It reaches **142 local files and
34.3k lines**, plus `zustand`, `@tanstack/react-router` and `@effect/atom-react`. That includes the
persisted composer draft store, connection storage and platform, the theme, toasts and the command
palette's logic. The coupling comes from a handful of edges, each with its own closure:

| Edge                              | Evidence (origin/main `0b02be3d5f`)                                                                                 | Reaches                           | Handled by   |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ------------ |
| Catalog refresh on open           | `ProviderModelPicker.tsx:135-150` (`RegistryContext`, `useAtomCommand(serverEnvironment.refreshProviders)`)         | `state/server.ts`, 70 files       | seam         |
| ChatGPT sharing row               | `ProviderModelPicker.tsx:328,500` → `ChatGptSharingControl.tsx:6` (`ChatGptUsageButton`)                            | 49 files                          | seam         |
| Settings link on an update notice | `ModelPickerContent.tsx:225,264` (`useNavigate`)                                                                    | TanStack Router                   | seam         |
| Favorites                         | `ModelPickerContent.tsx:393,492` → `hooks/useSettings.ts:479-549`                                                   | 95 files                          | seam         |
| Workspace catalog scan            | `ModelPickerContent.tsx:466` → `useProviderWorkspaceSnapshotRefresh.ts:10-15`                                       | `state/server.ts`                 | seam         |
| Server keybindings                | `ModelPickerContent.tsx:490` (`primaryServerKeybindingsAtom`, `state/server.ts:161`)                                | `state/server.ts`                 | seam         |
| Option writes                     | `TraitsPicker.tsx:37,328` (`useComposerDraftStore`)                                                                 | `composerDraftStore.ts`, 41 files | seam         |
| Command palette guard             | `ModelPickerContent.tsx:907` → `commandPaletteBus.ts:36-40`, a DOM query in a module that imports the palette store | 50 files                          | tree-shaking |
| Setup status text                 | `ModelPickerContent.tsx:34` → `ProviderStatusBanner.tsx:95-137`, pure functions beside the banner                   | 74 files                          | tree-shaking |
| Permissions footer                | `ComposerModelEffort.tsx:27` → `ComposerFooterControls.tsx`, used only by `ComposerPickerFooter`                    | 139 files                         | tree-shaking |
| `cn` helper                       | `lib/utils.ts:7,55` (`DraftId` for `newDraftId`)                                                                    | `composerDraftStore.ts`           | tree-shaking |

Stopping the walk at all eleven targets leaves **50 files and 8.1k lines**: rendering, keyboard,
search, ordering and pure provider/model helpers. Method: a static import walk over
`apps/web/src`, skipping `import type` (`apps/web/scripts/model-picker-closure.py`, see
"Re-measure" below).

The seam rows are code the picker runs while it renders, so they have to move behind an
interface. The tree-shaking rows are static imports whose used exports are pure: a library
build can drop the rest if it proves the unused modules have no required startup side effects.
Verify that assumption against the emitted artifact before adding another host adapter.

### The seam

`components/chat/modelPickerHost.tsx` defines `ModelPickerHost`, the hooks and the one component
behind the seam rows. Its default is Work's own host, `workModelPickerHost.tsx`, which holds exactly
the code that used to sit inline. That module registers itself when `ProviderModelPicker.tsx`
imports it for its side effect. `modelPickerHost.tsx` never imports it: `TraitsPicker` is reachable
from the composer draft store, and a static edge from it into the store, server atoms and settings
ran them before initialization (`twMerge`, `connectionAtomRuntime` TDZ errors in the first test run). The picker imports static forwarders from `modelPickerHost.tsx`
that carry the original names (`useEnvironmentModelPreferences`, `useToggleEnvironmentModelFavorite`,
`useProviderWorkspaceSnapshotRefresh`, `ChatGptSharingControl`), plus `useRefreshModelCatalog`,
`useOpenProviderSettings`, `useServerKeybindings` and `useSetProviderModelOptions` for code that was
inline. As a result:

- Existing Work mounts get the default host when they import `ProviderModelPicker`. A new mount
  of `TraitsPicker` or `ModelPickerContent` on its own needs an explicit host or an import of the
  Work adapter. An isolated test that mocks the entire picker module must account for this too.
- React Compiler (`apps/web/vite.config.ts`, `react({ compiler: true })`) keeps compiling the
  picker. It sees static hook imports. Only the one-line forwarders, whose callee is a value, opt
  out with `"use no memo"`. The compiler still reports dynamic-hook diagnostics on those
  forwarders when diagnostics are enabled. Do not replace the host object of a mounted picker.
- A host that is not Work wraps the picker in `ModelPickerHostProvider` with one constant object.
  The library build aliases `workModelPickerHost.tsx` to an empty module, so Work's atoms, router
  and draft store never enter that bundle. Measured from `src/model-picker/index.tsx` with that
  alias and the four tree-shaking rows stopped, the closure is **53 files and 9.0k lines**, with
  no router or zustand. Its one atom is `AcpRegistryIcon.tsx`'s local icon cache, which needs no
  Work state.
- Most edits to upstream files change only an import line. `ProviderModelPicker.tsx` loses its
  inline refresh block, and `ModelPickerContent.tsx` swaps `useNavigate` and the keybindings atom.
  An upstream change conflicts only when it changes those lines.

### The export

`apps/web/src/model-picker/index.tsx` is the one entry point. It exports:

- `ProviderModelPicker` and `ComposerEffortColumn` for the Work composer. The consumer bundle
  should export only `ModelPicker`, so these Work-facing exports remain outside the library API.
- `ModelPicker`, the narrow component for other hosts. Its props are `providers` (a bounded
  `ServerProvider` projection), `selection` (`{instanceId, model, options}`), `onSelect`,
  `onRefresh`, `onOpenSetup` and `locale`. It always docks the options column. A model without
  options shows **No effort levels**, as in `ComposerModelEffort.tsx:516-561`. The column keeps its
  width on every rail, so the popup geometry does not change when the rail changes.

Work remembers options by instance and model. The standalone picker preserves options when
reselecting the same model and emits empty options on a different model or instance. Its host can
restore saved values for the destination selection. Favorites are available in Work. The standalone
picker hides the rail and stars until a host supplies that capability. Update notices send the
notice's provider ID to the standalone host when it supplies a setup callback.

### Shipping (slice 4 inputs, not built in slice 1)

- **Build.** Add a Vite library entry that re-exports only `ModelPicker` from
  `src/model-picker/index.tsx` and emits ESM plus one CSS
  file into the runtime artifact's `client/` tree. `stage-work-runtime.mjs` already checks
  `client/index.html` (atum-desktop `apps/desktop/scripts/stage-work-runtime.mjs:33`). `react`,
  `react-dom` and `react/jsx-runtime` stay external; Desktop runs React 19.2
  (`apps/desktop/package.json:163`) and Work 19.3, and the picker uses only APIs both provide.
  Alias `workModelPickerHost.tsx` to the stub and verify tree-shaking with the actual library
  build. Before Desktop adopts it, load the emitted bundle in isolation and check it contains no
  `zustand`, `@clerk`, `@dnd-kit` or `@tanstack/react-router` code.
- **Consumption.** Desktop resolves the bundle at build time from the same pinned runtime archive.
  An alias in its Vite config points at the extracted file. Its npm tree gains no Work packages,
  and the picker version moves with the runtime pin.
- **CSS.** Desktop also uses Tailwind 4 (`apps/desktop/package.json:177`), with different theme
  tokens. Scope the emitted CSS under one root selector, and render Base UI portals into a
  container inside that root, because they otherwise mount on `document.body`.
- **Locale.** GT runs from singletons that `initializeGTSPA` sets up (`src/i18n/initializeI18n.ts`).
  Work's app and its tests call it at startup. The library entry must call it once, too. With a
  `locale` prop, `ModelPicker` wraps itself in `GTProvider`, as Work's `I18nProvider` does.
  Per-locale catalogs are about 0.7 MB each (`src/i18n/translations/*.json`). Ship only the
  picker's message hashes, extracted at build time, and load a locale on demand.

**Rejected alternative.** Desktop could host the picker in a second Work-rendered
`WebContentsView` laid over Matrix chat (`apps/desktop/electron/work/surface/electron-view.ts`).
That needs cross-view positioning and focus handoff, plus theme sync, for a popover that must
extend past the composer. The library is leaner.

## Re-measure

From `apps/web`: `python3 scripts/model-picker-closure.py components/chat/ProviderModelPicker.tsx
components/chat/ComposerModelEffort.tsx [--stop=<path> ...]`. It walks runtime imports, resolves
`~/` and relative specifiers, and prints local files, lines and external packages. Any new edge from
the picker into `state/`, `hooks/useSettings`, `composerDraftStore` or the router belongs in
`ModelPickerHost`.

## Verification, slice 1 (2026-11-26)

- `apps/web` typecheck (`effect-tsgo tsrs --noEmit`) reports no errors in touched files. The
  remaining errors are unresolved markdown packages (`react-markdown`, `remark-*`, `mdast-*`,
  `unified`, `vfile`) missing from the linked shared-deps tree, in files this change does not touch.
- Browser tests, run with those markdown modules stubbed in an uncommitted local config because the
  linked tree lacks them: `ProviderModelPicker`, `ProviderModelPicker.composition` and
  `ComposerModelEffort` 9/9; `ProjectSettingsPanel`, `ScheduledTasksSettings`,
  `ComposerPermissionsSection`, `useChatShortcuts` plus the picker logic, composer state, settings
  and draft store unit suites 175/175.
- Geometry: the new test measures the popup's layout width (`offsetWidth`; the open animation
  scales the bounding box). At 1280×800 it stays 554 px (360 list + 192 column) across the Codex
  rail, which has a Thinking select, and the Claude rail, which has no options. At 400×800 the
  column stacks under the list.
- Lint: the repo config cannot load its own `oxlint-plugin-t3code` under linked deps
  (`@oxlint/plugins` not linked). `oxlint` with `rules-of-hooks`, `exhaustive-deps` and
  `no-unused-vars` passes on the touched files.
- Review verification with the same markdown stubs passed 67 browser tests and 195 unit tests.
  Both standalone browser tests also passed with the Work host aliased out. The minified Work
  build passed the chunk-cycle guard, and Chromium imported each chat and relevant settings chunk
  as the first import in a fresh page. This exercises Work's module initialization order. The
  Desktop ESM entry and its CSS, portal and translation behavior still need artifact verification.
