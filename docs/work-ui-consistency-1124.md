# Work UI consistency (2026-11-24) — built, not live

Owner, testing 0.20.55 / runtime 0.1.14. Desktop companion: atum-desktop `feat/ui-consistency-1124`
(`docs/ui-consistency-1124.md`), which also fixes the Atum model names and the New thread button.

- **The "AT"/"CO" badge.** T3 badges an instance with its initials when two enabled instances share a
  driver. Atum registers hidden instances beside the visible ones: "Atum (delegated)" beside "Atum" (both
  ACP Registry, no agent id → "AT"), and `atum-relay-codex` beside native Codex ("CO"). Both are
  `showInPicker: false`. `shouldShowInstanceBadge` now compares visible and hidden instances only among
  themselves (`packages/client-runtime/src/state/providerInstanceDisplay.ts`), so a user's two real
  Codex accounts still get badges. Upstreamable as is.
- **Atum's mark.** The bare eclipse read as a black dot on light surfaces. The asset now carries the dark
  tile the desktop agent picker draws (`BrandMark` inset), so both pickers show the same mark
  (`apps/web/public/atum-provider-mark.svg`).
- **Switches.** The Work theme sets T3's default switch to Kit's 22×38 proportions
  (`scripts/atum-work/theme.mjs`, regenerated `atum-work/theme/atum.json`; palette unchanged).

Verification: client-runtime test (new case fails on base, passes); client-runtime typecheck 0; web
typecheck has one pre-existing error in `providerSettingsVisibility.test.ts` (present on base); lint and
format clean on touched files; `src/atum` tests and `brand.test.mjs` pass.

## Round 2

- **Thread-list edge for the host.** `apps/web/src/atum/SidebarReport.tsx` reports the list's open
  state and right edge through the owner preload (`window.atumWork.reportSidebar`), so Atum's title band
  ends its bell at that edge as the chat roster does. Atum builds only (`VITE_ATUM_WORK_BUILD`).
- **One model picker.** `atum-work/model-picker-spec.json` is a byte-identical copy of atum-desktop's
  `src/matrix/model-picker-spec.json`. `ProviderModelPicker.atumSpec.browser.test.tsx` measures T3's
  real picker against it, so an upstream sync that moves the picker fails here: update both copies.
  The desktop's Work theme supplies the chip, type and search colour from the same file.
- The grey box around the model search was the desktop theme's global focus outline; fixed there.

Verification: lint 0 and fmt clean on touched files; web typecheck only the pre-existing
`providerSettingsVisibility.test.ts` error; picker browser tests 7/7; `src/atum` unit tests pass.

## Round 3

Owner, 2026-11-24: one set of thinking words, and the two pickers match per the Atum Kit. Atum
builds only (`VITE_ATUM_WORK_BUILD`); upstream T3 is unchanged.

- **Thinking words.** `apps/web/src/atum/pickerLabels.logic.ts` relabels a model's reasoning control
  (`role: "reasoning"`, or T3's `effort`/`reasoningEffort`/`reasoning`/`variant`) from
  `atum-work/model-picker-labels.json`: Quick, Balanced, Thorough, Extra thorough, Maximum (and Off,
  Instant). Option ids, the values sent to providers, are unchanged; an id the file does not name
  keeps its label. Applied once in `getProviderModelCapabilities` (`providerModels.ts`), which every
  picker, chip and column reads. UI locales the file lacks (T3 has no Vietnamese) read in English.
- **Rows.** Atum's own models carry their muted line after the check (`ModelListRow` `tagline`,
  "Suggested · Good for everyday tasks" on Nguyệt Thực), as the desktop picker writes it.
- **Surface.** The desktop's generated theme gives the picker the Kit's glass, untinted rail, list
  (`data-model-picker-list`, Atum builds) and thinking column, no rule under Favorites, and the
  ⌘1–⌘9 hint as plain text.
- **Copies.** `atum-work/model-picker-digests.json` records the shared files' sha256;
  `pickerLabels.logic.test.ts` checks the copies against it and runs in Atum's CI.

Known: with `VITE_ATUM_WORK_BUILD=1`, upstream's `ComposerModelEffort.browser.test.tsx` "draws an
agent's reasoning as bars" looks for "Medium" and fails, because Atum builds say "Balanced". Atum's CI
runs browser tests without the flag, where it passes.

Verification: lint 0 and fmt clean on touched files; web typecheck only the pre-existing
`providerSettingsVisibility.test.ts` error; picker browser tests 8/8 (default build); `src/atum` 10/10.


## Kit on T3 (sync, 2026-11-24)

Owner decision 2026-11-24, option B: T3's design system is the Atum Kit base, and Work's theme is
colours only (atum-desktop `feat/kit-t3-foundation-1124`, 4d59323f). `atum-work/model-picker-spec.json`
and `model-picker-digests.json` are copied byte for byte from atum-desktop `src/matrix/`: the chip is
T3's (14 px text on the 8 px control radius) and Work no longer receives picker CSS from the desktop.
`model-picker-labels.json` was already identical. Verified with `shasum -a 256` against the digests file.
