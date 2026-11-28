# Work rail nudge: settled threads stop counting as unread (2026-11-28)

Owner, 2026-11-28: "i think relayed convos are hidden now but the Work icon on side rail still
showing the nudge?"

## Cause

The desktop's Work rail badge is what `apps/web/src/atum/AttentionReport.tsx` reports: threads that
ask for the person (waiting) and threads that finished unseen (the ink dot). It reads
`quietThreadShellsAtom`, which already drops `hidden` threads, so relay threads launched with
`hidden: true` never counted.

The owner's Work state (read-only copy of `statev2.sqlite`, 2026-11-28) showed one hidden relay
thread and three older relay threads launched before the hidden flag existed
(`docs/operations/atum-work-relay-threads.md`: "Older threads retain their original visibility").
All three were settled, so they sit in the folded Settled shelf, but each had a completed run newer
than its `lastVisitedAt`. The report counted them, so the rail showed a dot for nothing the owner
could see.

## Change

- `apps/web/src/atum/attention.logic.ts` (new): the count as a pure function. A thread with an
  approval or question counts wherever it sits. A finished, unseen thread counts only when it is not
  settled.
- `AttentionReport.tsx` calls it; behaviour otherwise unchanged.

Not changed: old relay threads keep their visibility (no backfill of `hidden`), as the runtime doc
decides. Snoozed threads still count as before.

## Verification

- `vp test run src/atum/attention.logic.test.ts` (apps/web) — 4 passed.
- `vp run --filter ./apps/web typecheck` — 0 errors.
- `vp lint` and `vp fmt --check` on the touched files — clean.

Reaches the owner with the next Work runtime build pinned by atum-desktop.
