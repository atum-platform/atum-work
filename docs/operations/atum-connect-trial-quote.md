# Atum Connect private trial quote — 2026-11-24

**$5/month incremental base before tax**, using Workers Paid and a dedicated
`atum_connect` database/role on the already-running AWS Marketplace Postgres.
No new PlanetScale account/card, VM, database instance or domain purchase.
Keep the owner-approved $10–15 envelope as a reserve; it is not a billing cap.

- Workers Paid: $5/account/month minimum, including Hyperdrive, Queues and DO
  allowances. [Official pricing](https://developers.cloudflare.com/workers/platform/pricing/)
  checked 2026-11-24. Existing account usage can consume those allowances.
- Hyperdrive: $0 incremental within the existing Workers plan.
  [Official pricing](https://developers.cloudflare.com/hyperdrive/platform/pricing/).
- Workers VPC private database service: free during open beta as checked
  2026-11-24; re-quote at general availability.
  [Official pricing](https://developers.cloudflare.com/workers-vpc/platform/pricing/).
- Existing AWS PostgreSQL instance: $0 incremental instance base. Marginal AWS
  storage, backup and traffic costs remain usage-dependent; measure rather than
  claim free unlimited AWS egress. Five origin connections, trial only.
- Existing domain/DNS and Cloudflare Tunnel: no new registration; retain account
  tunnel headroom check. The database uses its existing private tunnel via a VPC
  service; no inbound database port. Axiom/APNs/FCM remain off.

Optional `RELAY_DATABASE_PROVIDER=planetscale` retains the prior native PS-5
Singapore non-HA option at the previously quoted +$5/month (recheck vendor price
before selecting it). It is never the default and requires its own vendor account.

Built-not-live. No billing or cloud account was inspected, no resource created.
This estimate assumes existing AWS capacity suffices and included Cloudflare
usage is available. Verify metered use during the private trial before expansion.
