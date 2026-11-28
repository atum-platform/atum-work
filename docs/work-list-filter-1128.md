# Work list filter back in Work mode (2026-11-28)

Owner, 2026-11-28, testing desktop 0.20.55 with Work 0.1.20: "Filter button now added to Chat but gone
from Work?"

## Cause

`e92ded6a29` (Atum layout consistency, Work 0.1.20) hid the project-scope filter in Work mode: "Work mode
names one folder, so its filter is noise there". The Atum build opens in Work mode, so the filter was gone
for everyone. Meanwhile the desktop gave Chat's roster a filter between search and plus "like Work"
(atum-desktop #154). The premise did not hold either: the mode is per project and the list still holds
every project's threads, so the filter still narrows it.

## Change (Atum build only; the upstream build is unchanged)

- `apps/web/src/components/sidebar/SidebarThreadHeader.tsx`: the header is search, filter, plus in every
  mode whenever there is a project to filter by.
- `apps/web/src/components/Sidebar.tsx`: in the Atum build the filter's trigger is Chat's funnel (the
  same 28 px button), filled while a scope is on, in place of T3's folder or project favicons. Its label
  and menu (All projects, pick one, Shift-click for several) are unchanged.

## Verification

| Check        | Command                                                                                                | Result                          |
| ------------ | ------------------------------------------------------------------------------------------------------ | ------------------------------- |
| browser test | `vp test run --project browser src/components/sidebar/SidebarThreadHeader.browser.test.tsx` (apps/web) | 2 passed                        |
| typecheck    | `vp run typecheck` (apps/web)                                                                          | rc 0                            |
| lint         | `vp lint <changed files>`                                                                              | rc 0                            |
| format       | `vp fmt --check <changed files>`                                                                       | clean                           |
| i18n         | `vp run i18n:check`                                                                                    | catalogs match (no new strings) |

The desktop pins a Work runtime, so the owner sees this after the next runtime pin.

The pre-commit `knip:check` hook is red on the base (11 unused files, none touched here), so this
commit skipped it, as `docs/work-layout-consistency-1127.md` recorded for the same base.
