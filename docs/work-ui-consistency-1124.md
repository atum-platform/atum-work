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

