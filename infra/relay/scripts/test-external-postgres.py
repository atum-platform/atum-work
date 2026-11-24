#!/usr/bin/env python3
"""Disposable real PostgreSQL proof; requires local initdb/pg_ctl/psql/OpenSSL."""
import os
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile
import time

scripts = Path(__file__).resolve().parent
work = Path(tempfile.mkdtemp(prefix='atum-connect-postgres-'))
data = work / 'data'
with socket.socket() as sock:
    sock.bind(('127.0.0.1', 0))
    port = str(sock.getsockname()[1])
env = {**os.environ, 'PGHOST': str(work), 'PGPORT': port, 'PGDATABASE': 'postgres',
       'PGUSER': os.environ.get('USER', 'postgres'), 'PGPASSWORD': 'disposable-only', 'PGSSLMODE': 'prefer',
       'ATUM_CONNECT_DATABASE_PASSWORD': 'disposable-only'}
def run(args, *, sql=None, extra=None, expected=0):
    result = subprocess.run(args, input=sql, text=True, env={**env, **(extra or {})}, capture_output=True)
    if result.returncode != expected:
        raise RuntimeError(f'{args[0]} exit={result.returncode}: {result.stderr}')
    return result.stdout.strip()
def query(sql, **extra):
    return run(['psql', '-X', '-Atq', '-v', 'ON_ERROR_STOP=1'], sql=sql, extra=extra)
started = False
try:
    run(['initdb', '-D', str(data), '-A', 'trust', '--no-locale', '--encoding=UTF8'])
    run(['pg_ctl', '-D', str(data), '-l', str(work/'postgres.log'), '-o', f'-p {port} -k {work} -h 127.0.0.1', 'start'])
    started = True
    run(['psql', '-X', '-q', '-f', str(scripts/'bootstrap-postgres.sql')])
    relay = {'PGDATABASE':'atum_connect', 'PGUSER':'atum_connect'}
    for _ in range(2):
        run(['python3', str(scripts/'migrate-external.py')], extra=relay)
    expected = len(list((scripts.parent/'migrations/postgres').glob('*/migration.sql')))
    assert query('select count(*) from relay_migrations', **relay) == str(expected)
    assert query("select rolsuper or rolcreatedb or rolcreaterole or rolreplication or rolbypassrls from pg_roles where rolname=current_user", **relay) == 'f'
    run(['python3', str(scripts/'migrate-external.py')], extra={'PGUSER':'atum_connect'}, expected=3)
    query("update relay_migrations set sha256='tampered' where name=(select min(name) from relay_migrations)", **relay)
    run(['python3', str(scripts/'migrate-external.py')], extra=relay, expected=3)
    run(['openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=relay-test',
         '-addext', 'subjectAltName=IP:127.0.0.1', '-keyout', str(data/'server.key'), '-out', str(data/'server.crt')])
    (data/'server.key').chmod(0o600)
    query(f"ALTER SYSTEM SET ssl_cert_file='{data}/server.crt';\nALTER SYSTEM SET ssl_key_file='{data}/server.key';\nALTER SYSTEM SET ssl='on';\nSELECT pg_reload_conf();")
    hba = data/'pg_hba.conf'
    hba.write_text('local atum_connect atum_connect trust\nlocal all atum_connect reject\nhostssl atum_connect atum_connect all scram-sha-256\nhost all atum_connect all reject\n'+hba.read_text())
    query('SELECT pg_reload_conf();')
    time.sleep(1)
    assert query('SHOW ssl') == 'on'
    assert query('select ssl from pg_stat_ssl where pid=pg_backend_pid()', **{**relay, 'PGHOST':'127.0.0.1', 'PGSSLMODE':'verify-full', 'PGSSLROOTCERT':str(data/'server.crt')}) == 't'
    result = subprocess.run(['psql','-X','-Atqc','select 1'], env={**env,'PGHOST':'127.0.0.1','PGUSER':'atum_connect'}, capture_output=True)
    assert result.returncode != 0
    print(f'POSTGRES_PROOF_OK migrations={expected}; repeat-safe; wrong-db/checksum refused; verified TLS; cross-db login refused')
finally:
    if started:
        subprocess.run(['pg_ctl','-D',str(data),'-m','fast','stop'], capture_output=True, check=True)
    shutil.rmtree(work)
