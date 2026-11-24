# Relay provisioning dependency handoff — 2026-11-24

Owner request: native relay first; remove PlanetScale account/card dependency and
provide the missing assertion issuer. **Built-not-live**. No push, PR, CI, cloud
resource, DNS, deployment, real credential read or spend by this worker. No nested
agents/review. Coordinator retains assembly review and production authority.

Base `ac9118cf` on `feat/t3-connect-t1-1124`, freshly cloned and ff-only pulled.
Companion issuer is on platform `feat/atum-connect-issuer-1124` from origin/main.

External Postgres is now default in native Alchemy Hyperdrive. PlanetScale stays
explicitly optional; its pinned credentials layer is lazy and its database
resource is not evaluated on the external path. Uses existing native VPC origin
`serviceId`, not a public connection attempt to a Docker private address. Password
is Effect Redacted; query cache remains off, trial origin pool limit five.

Exact SQL isolates database/role. Host helper adds TLS with reload and role-only
HBA rules, applies migrations, retains seed/cert/backup, escrows the password via
SSM without stdout. Host role needs scoped PutParameter/KMS permission first.
Private origin CA upload/VPC creation and source credential handling belong to
the coordinator; nothing was run on AWS. One-year cert renewal and Docker IP
reconciliation after container recreation are known operational requirements.

Runbook `atum-connect-runbook.md` contains the dependency-ordered plan/apply/verify
sequence; platform `atum-connect-issuer.md` contains key/custody/Shell prebuilt
steps. The provision entrypoint has an offline plan, guarded apply and HTTP smoke.
The plan is not an account drift diff; smoke is not a SQL/off-LAN proof. Quote is
**$5/month incremental base** (Workers), VPC beta currently free, existing AWS
instance reused; storage/traffic/overages excluded. Owner budget remains $10–15.

Retained local verification (Node 24.21.0; temporary deps from locked fixture):

- `tsc --noEmit --project infra/relay/tsconfig.json` via temporary TypeScript:
  **exit 0**. Earlier Config.redacted typo fixed to Config.Redacted; transient
  missing workspace links restored before the retained clean run.
- From infra/relay, `vp test run --config ../../vite.config.ts src/externalPostgres.test.ts src/auth/AtumConnect.loopback.test.ts`:
  **3 tests, 2 files, exit 0**. Native HTTP/Atum/DPoP plus external origin guards.
- `node --experimental-strip-types infra/relay/scripts/verify-platform-assertion.ts /path/to/atum-platform`:
  **exit 0**, real Shell JWS -> relay verify; invalid audience/expired refused.
- `PATH=/opt/homebrew/opt/postgresql@17/bin:$PATH python3 infra/relay/scripts/test-external-postgres.py`:
  **exit 0**. Disposable PostgreSQL 17: bootstrap role/database, all **15**
  migrations, repeat run, wrong database exit **3**, checksum mismatch exit **3**,
  verified TLS after reload, cross-database login denied. Test stops/removes its
  own cluster. No production SQL executed. Initial psql quit-code guard proved
  ineffective and was replaced with ON_ERROR_STOP + SQL exception.
- `bash -n` on both operator shell scripts, `git diff --check`, synthetic
  `provision-atum.sh --plan`: **exit 0**. No provider account/plan invocation.

Open coordinator steps: review/integrate both commits, exact-head required checks,
create/escrow issuer key, deploy audited Shell prebuilt, backup AWS Marketplace,
bootstrap isolated DB/TLS, CA/VPC setup, native Alchemy apply, authenticated DPoP
and off-LAN Mac/MCP acceptance. Retain every row as open until live for users.
