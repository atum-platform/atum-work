# Atum Work standalone runtime

## Defaults

The Work web build skips automatic Welcome onboarding. Runtime telemetry
requires explicit opt-in. Connect remains unconfigured in the standalone
build and process environment. Storage cleanup uses upstream defaults.

## Managed provider submit

Provision the managed ACP provider with instance ID `atum-managed`. The sandboxed
owner view's preload exposes `window.atumWork.readModelAccess()`, a zero-argument
read through desktop main to the managed-model proxy. Return `allowed`, `empty`,
or `unavailable`. Main owns the caller's account and origin validation and bounds
the IPC call. No proxy credentials or URLs cross into the view. A refused or failed
check keeps the draft and skips dispatch. The proxy's own metering decision also
covers races after the read.
