# Work runtime 0.1.14 recovery — 2026-11-24

State: built and smoke-tested locally; not installed, published, or live for users.

Built from runtime source 465ae1b95 with UI source 219dc0d4d merged cleanly. The retained native sign-in fix fd60a217 removes the retired Work custody preflight that returned false before T3 Codex startAuth. It also hides the internal delegated provider's settings.

T3's local ACP provider does not expose an arbitrary per-instance icon setting: the settings schema contains command and registry fields, and ProviderInstanceIcon accepts only official registry icon URLs. The Atum-build-only presentation seam now renders the existing desktop atum-mark.svg for the two managed Atum labels; other ACP instances keep native rendering. The SVG is copied unchanged from the desktop's public asset. The boot shell uses a 22px spinner following the existing Kit loading-state dimensions instead of an application logo.

Build: exact Node 26.13.1; scripts/atum-work/build.mjs v0.1.11 atum-work/brand.json NODE_LICENSE OUTPUT v0.1.14. Rust resource monitor built from the locked manifest. Archive ad-hoc signed by the native packer. No CI, cloud, paid calls, provider authentication, or installed app writes.

Archive smoke test exit 0: packaged arm64 runtime paired on loopback, rendered its brand title, skipped Welcome, and kept Connect off. Provider sign-in/settings/icon utility tests: 3 files, 8 tests, exit 0 (web unit project). Workspace-root test attempts failed to load mobile dependencies because only archive dependencies were installed; rerunning the correct web unit project passed.

Output: work-0.1.14/atum-work-0.1.14-darwin-arm64.tar.gz in the local release-build-inputs directory. SHA256: 83cfbb5a9257fc4ae3660acc76c09de09eaf081042fa5b63c6a84b0e02b2ad20. Desktop pin must reference the final source commit including this note. Temporary build dependencies are removed after validation. Owner authentication and installed startup acceptance remain open.

The local commit hook's formatting and focused lint succeeded. Its full-monorepo knip check failed loading uninstalled Expo/Astro configurations and reported pre-existing mobile unused files. Installing all unrelated surfaces would exceed the scoped archive install and disk limit. The local checkpoint therefore disables only that commit hook; full knip remains unverified. No code was changed to suppress it.
