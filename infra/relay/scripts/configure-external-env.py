#!/usr/bin/env python3
"""Coordinator only: SSM -> private env file, no secret stdout/argv."""
import json
import os
from pathlib import Path
import shlex
import subprocess
import sys
from urllib.parse import quote

if len(sys.argv) != 5:
    raise SystemExit('Usage: configure-external-env.py ENV_FILE PRIVATE_IP VPC_SERVICE_ID PUBLIC_JWKS_FILE')
path, host, service, jwks_path = sys.argv[1:]
target = Path(path)
if target.stat().st_mode & 0o077:
    raise SystemExit('Environment file must be chmod 600')
jwks = json.loads(Path(jwks_path).read_text())
if not jwks.get('keys') or any('d' in key for key in jwks['keys']):
    raise SystemExit('Require public-only JWKS')
password = subprocess.run(['aws', 'ssm', 'get-parameter', '--region', 'ap-southeast-1',
    '--name', '/atum/prod/connect_db_password', '--with-decryption', '--query', 'Parameter.Value',
    '--output', 'text'], check=True, capture_output=True, text=True).stdout.strip()
values = {
    'RELAY_ORIGIN_DATABASE_URL': f'postgresql://atum_connect:{quote(password, safe="")}@{host}/atum_connect?sslmode=require',
    'RELAY_POSTGRES_VPC_SERVICE_ID': service,
    'RELAY_DATABASE_MIGRATED': 'true',
    'ATUM_CONNECT_ASSERTION_JWKS': json.dumps(jwks, separators=(',', ':')),
}
lines = [line for line in target.read_text().splitlines() if line.split('=', 1)[0] not in values]
lines += [f'{key}={shlex.quote(value)}' for key, value in values.items()]
temporary = target.with_name(target.name + '.new')
fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(fd, 'w') as handle:
    handle.write('\n'.join(lines) + '\n')
os.replace(temporary, target)
print('PRIVATE_RELAY_ENV_CONFIGURED (no credential output)')
