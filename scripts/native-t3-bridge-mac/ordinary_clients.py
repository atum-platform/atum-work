"""Real OAuth: outside clients and linked peers keep working with Atum admission on."""
import base64
import hashlib
import json
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import time
from urllib.parse import urlparse, parse_qs, urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

root = Path(__file__).resolve().parents[2]
with tempfile.TemporaryDirectory(prefix='native-outside-clients-') as directory:
    home = Path(directory)
    state = home/'userdata'
    state.mkdir()
    (state/'settings.json').write_text(json.dumps({'linkedEnvironmentsEnabled': True}))
    forward = home/'forward.json'
    forward.write_text('[]')
    forward.chmod(0o600)
    env = {'PATH': os.environ['PATH'], 'HOME': directory, 'ATUM_WORK_MAC_ID': 'mac-a',
        'ATUM_WORK_FORWARD_GRANTS_FILE': str(forward), 'T3CODE_TELEMETRY_ENABLED': 'false', 'OTEL_SDK_DISABLED': 'true'}
    node = os.environ.get('WORK_NODE', '/opt/homebrew/opt/node@24/bin/node')
    cli = [node, str(root/'apps/server/src/bin.ts')]
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    origin = f'http://127.0.0.1:{port}'
    def request(path, body=None, headers=None, form=False):
        data = (urlencode(body) if form else json.dumps(body)).encode() if body is not None else None
        with urlopen(Request(origin+path, data=data, headers={
            'content-type': 'application/x-www-form-urlencoded' if form else 'application/json', **(headers or {})}), timeout=15) as response:
            return json.load(response)
    with (home/'server.log').open('w+') as log:
        child = subprocess.Popen(cli+['serve', '--base-dir', directory, '--host', '127.0.0.1', '--port', str(port)],
            cwd=root, env=env, stdout=log, stderr=log)
        try:
            for _ in range(240):
                try: request('/.well-known/oauth-authorization-server'); break
                except (URLError, OSError):
                    if child.poll() is not None: log.seek(0); raise RuntimeError(log.read()[-3000:])
                    time.sleep(.25)
            else: raise RuntimeError('Work unavailable')
            for peer in (False, True, None):
                registered = request('/oauth/mcp/register', {'client_name': 'Decoy native client' if peer is None else 'Decoy outside peer' if peer else 'Decoy outside client',
                    'redirect_uris': ['http://localhost:19233/callback'], **({'software_id': 't3code-peer-link'} if peer else {})})
                if peer is None:
                    grant = {'clientId': registered['client_id'], 'binding': {'owner': 'owner', 'agent': 'agent',
                        'generation': '1', 'mac': 'mac-a', 'consent_revision': 1}, 'actor': 'owner',
                        'audience': 'owner_dm', 'expiresAt': int(time.time()*1000)+600000, 'enabled': True}
                    forward.write_text(json.dumps([grant]))
                pairing = json.loads(subprocess.check_output(cli+['auth', 'pairing', 'create', '--base-dir', directory, '--json'], env=env, cwd=root, text=True))
                verifier = 'decoy-'+'x'*64
                authorization = {'response_type': 'code', 'client_id': registered['client_id'],
                    'redirect_uri': 'http://localhost:19233/callback', 'resource': origin+'/mcp',
                    'code_challenge_method': 'S256', 'code_challenge': base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip('=')}
                approved = request('/oauth/mcp/decision', {'authorization': authorization,
                    'decision': {'_tag': 'pairing-code', 'access': 'full-access', 'code': pairing['credential']}})
                code = parse_qs(urlparse(approved['redirectTo']).query)['code'][0]
                token = request('/oauth/mcp/token', {'grant_type': 'authorization_code', 'code': code,
                    'client_id': registered['client_id'], 'redirect_uri': authorization['redirect_uri'],
                    'code_verifier': verifier, 'resource': origin+'/mcp'}, form=True)
                result = request('/mcp', {'jsonrpc': '2.0', 'id': 1, 'method': 'initialize',
                    'params': {'protocolVersion': '2025-06-18', 'capabilities': {}, 'clientInfo': {'name': 'decoy', 'version': '1'}}},
                    headers={'authorization': 'Bearer '+token['access_token'], 'accept': 'application/json, text/event-stream'})
                assert 'result' in result, result
                if peer is None:
                    def initialize(bearer):
                        return request('/mcp', {'jsonrpc': '2.0', 'id': 2, 'method': 'initialize',
                            'params': {'protocolVersion': '2025-06-18', 'capabilities': {}, 'clientInfo': {'name': 'decoy', 'version': '1'}}},
                            headers={'authorization': 'Bearer '+bearer, 'accept': 'application/json, text/event-stream'})
                    def refused(bearer):
                        try: initialize(bearer)
                        except HTTPError as error: assert error.code == 403
                        else: raise AssertionError('Native consent was not refused')
                    grant['binding']['generation'] = '2'
                    grant['binding']['consent_revision'] = 2
                    forward.write_text(json.dumps([grant]))
                    refused(token['access_token'])
                    pairing = json.loads(subprocess.check_output(cli+['auth', 'pairing', 'create', '--base-dir', directory, '--json'], env=env, cwd=root, text=True))
                    approved = request('/oauth/mcp/decision', {'authorization': authorization,
                        'decision': {'_tag': 'pairing-code', 'access': 'full-access', 'code': pairing['credential']}})
                    code = parse_qs(urlparse(approved['redirectTo']).query)['code'][0]
                    renewed = request('/oauth/mcp/token', {'grant_type': 'authorization_code', 'code': code,
                        'client_id': registered['client_id'], 'redirect_uri': authorization['redirect_uri'],
                        'code_verifier': verifier, 'resource': origin+'/mcp'}, form=True)
                    assert 'result' in initialize(renewed['access_token'])
                    grant['binding']['mac'] = 'foreign-mac'
                    forward.write_text(json.dumps([grant]))
                    refused(renewed['access_token'])
            print('PASS real outside/peer OAuth; stale native generation refused; fresh approval restored; foreign Mac refused')
        finally:
            child.terminate()
            try: child.wait(timeout=15)
            except subprocess.TimeoutExpired: child.kill(); child.wait()
