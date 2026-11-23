# Work provider recovery — 2026-11-23

State: implemented locally, not released. Base: 69a0515771 (0.1.13).

The current desktop host removed ChatGPT custody and no longer exposes `prepareCodexSignIn`. The released frontend required that optional bridge method to return true before native Codex `startAuth`; every Connect attempt therefore stopped with a readiness error. The preflight now allows T3's existing login flow to proceed, including its existing provider auth URL handling. No authentication implementation or credential transfer was added.

Settings grouped every configured provider instance without honoring `showInPicker: false`. The settings projection now honors that flag for explicit instances and default slots. The delegated Atum instance remains enabled and configured; existing picker filtering is preserved.

Focused Vitest: two files, seven tests, exit 0. Existing shared Vitest was used with a `vite-plus/test` alias; nothing was installed. The focused tests cover the missing/retired custody bridge, sign-in URL dispatch, and hidden relay configuration preservation. Actual OAuth, full frontend typechecking and browser rendering were not exercised because this checkout has no fork dependency installation. Changes are intentionally minimal for the concurrent upstream integration lane. No pushes, PRs, CI, cloud, installed data or credentials were used.
