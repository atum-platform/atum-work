#!/usr/bin/env bash
# COORDINATOR ONLY on AWS Marketplace host as root. No public port, no restart.
set -euo pipefail
[[ "${1:-}" = --apply ]] || { echo 'Usage: prepare-marketplace-postgres.sh --apply (AWS host only)'; exit 2; }
script_dir="$(cd "$(dirname "$0")" && pwd)"
kit=/opt/atum/marketplace-kit/current
runtime=/opt/atum/marketplace-runtime
private=/opt/atum/connect-postgres
umask 077
mkdir -p "$private"
export ATUM_MARKETPLACE_RUNTIME="$runtime"
# compose needs the existing image revision even for exec; no container is recreated.
export ATUM_MARKETPLACE_REVISION="$(basename "$(readlink -f "$kit")")"
dc=(docker compose -f "$kit/deploy/marketplace/compose.yaml" -f "$kit/deploy/marketplace/compose.aws.yaml")
container="$("${dc[@]}" ps -q marketplace-db)"
[[ -n "$container" ]] || { echo 'Marketplace database not running' >&2; exit 2; }
# Deliberately refuse rerunning bootstrap: never change a live password by accident.
[[ ! -e "$private/password" ]] || { echo 'Existing relay bootstrap; resume migrations manually, do not regenerate' >&2; exit 2; }
openssl rand -hex 32 | tr -d '\n' > "$private/password"
# Inject via stdin into a container shell variable, not Docker env/argv or logs.
{ cat "$private/password"; printf '\n'; cat "$script_dir/bootstrap-postgres.sql"; } | docker exec -i "$container" sh -ec '
  read -r ATUM_CONNECT_DATABASE_PASSWORD; export ATUM_CONNECT_DATABASE_PASSWORD
  exec psql -X -q -U marketplace -d postgres
'
python3 "$script_dir/migrate-external.py" --print-sql | docker exec -i "$container" psql -X -q -U atum_connect -d atum_connect
# Cloudflare VPC validates this private CA; certificate is IP-bound to current bridge address.
db_ip="$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$container")"
openssl req -x509 -newkey rsa:2048 -nodes -days 365 -subj /CN=atum-connect-postgres \
  -addext "subjectAltName=IP:$db_ip" -addext 'basicConstraints=critical,CA:TRUE' \
  -keyout "$private/server.key" -out "$private/server.crt" 2>/dev/null
# Persist certs in the existing data volume. ssl=on is reloadable; existing non-TLS clients continue.
docker cp "$private/server.key" "$container:/var/lib/postgresql/data/connect-server.key"
docker cp "$private/server.crt" "$container:/var/lib/postgresql/data/connect-server.crt"
docker exec "$container" sh -ec 'chown postgres:postgres /var/lib/postgresql/data/connect-server.*; chmod 600 /var/lib/postgresql/data/connect-server.key'
docker exec -i "$container" psql -X -q -U marketplace -d postgres <<'SQL'
ALTER SYSTEM SET ssl_cert_file = '/var/lib/postgresql/data/connect-server.crt';
ALTER SYSTEM SET ssl_key_file = '/var/lib/postgresql/data/connect-server.key';
ALTER SYSTEM SET ssl = 'on';
SELECT pg_reload_conf();
SQL
# Restrict this login to its own database before the general instance HBA rules.
docker exec "$container" sh -ec '
  hba=/var/lib/postgresql/data/pg_hba.conf
  cp "$hba" "$hba.pre-connect"
  { printf "%s\n" "local atum_connect atum_connect trust" "local all atum_connect reject" "hostssl atum_connect atum_connect all scram-sha-256" "host all atum_connect all reject"; cat "$hba.pre-connect"; } > "$hba"
  chown postgres:postgres "$hba"
'
docker exec "$container" psql -X -q -U marketplace -d postgres -c 'SELECT pg_reload_conf()' >/dev/null
sleep 1
docker exec "$container" psql -X -q -At -U marketplace -d postgres -c 'SHOW ssl' | grep -qx on
# Require host IAM permission ONLY for this new parameter; it is not printed.
aws ssm put-parameter --region ap-southeast-1 --name /atum/prod/connect_db_password \
  --type SecureString --value "file://$private/password" >/dev/null
printf 'MARKETPLACE_RELAY_DB_READY private_ip=%s database=atum_connect role=atum_connect migrations=applied cert=/opt/atum/connect-postgres/server.crt\n' "$db_ip"
