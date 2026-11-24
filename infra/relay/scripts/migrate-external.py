#!/usr/bin/env python3
"""Ordered, transactional migrations. Uses PG* environment; never prints a DSN."""
import hashlib
import pathlib
import subprocess
import sys

root = pathlib.Path(__file__).resolve().parents[1] / 'migrations/postgres'
lines = [r'\set ON_ERROR_STOP on', "SELECT current_database() = 'atum_connect' AND current_user = 'atum_connect' AS isolated \\gset", r'\if :isolated',
         "SELECT pg_advisory_lock(6241124);", 'CREATE TABLE IF NOT EXISTS public.relay_migrations (name text PRIMARY KEY, sha256 text NOT NULL);']
for path in sorted(root.glob('*/migration.sql')):
    name, digest = path.parent.name, hashlib.sha256(path.read_bytes()).hexdigest()
    lines += [f"SELECT EXISTS(SELECT 1 FROM public.relay_migrations WHERE name='{name}') AS applied \\gset", r'\if :applied',
              f"DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM public.relay_migrations WHERE name='{name}' AND sha256='{digest}') THEN RAISE EXCEPTION 'migration checksum mismatch'; END IF; END $$;", r'\else',
              'BEGIN;', path.read_text(), f"INSERT INTO public.relay_migrations VALUES ('{name}', '{digest}');", 'COMMIT;', r'\endif']
lines += ['SELECT pg_advisory_unlock(6241124);', r'\else', r'\echo Refusing migration outside isolated relay database/role', "DO $$ BEGIN RAISE EXCEPTION 'isolated relay database/role required'; END $$;", r'\endif']
sql = '\n'.join(lines) + '\n'
if sys.argv[1:] == ['--print-sql']:
    print(sql, end='')
elif not sys.argv[1:]:
    raise SystemExit(subprocess.run(['psql', '-X', '-q'], input=sql, text=True).returncode)
else:
    raise SystemExit('Usage: migrate-external.py [--print-sql]')
