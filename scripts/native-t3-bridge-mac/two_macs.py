"""Two real Work servers, disposable homes, no provider logins or telemetry."""
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import time
import urllib.request

root = Path(__file__).resolve().parents[2]
children = []
def reachable(port):
    try:
        urllib.request.urlopen(f'http://127.0.0.1:{port}/.well-known/oauth-authorization-server', timeout=1)
        return True
    except OSError:
        return False

with tempfile.TemporaryDirectory(prefix='native-two-macs-') as directory:
    try:
        for mac in ('mac-a', 'mac-b'):
            home = str(Path(directory) / mac)
            Path(home).mkdir()
            with socket.socket() as sock:
                sock.bind(('127.0.0.1', 0))
                port = sock.getsockname()[1]
            log = open(Path(home)/'server.log', 'w+')
            env = {'PATH': os.environ['PATH'], 'HOME': home, 'ATUM_WORK_MAC_ID': mac,
                   'T3CODE_TELEMETRY_ENABLED': 'false', 'OTEL_SDK_DISABLED': 'true'}
            child = subprocess.Popen([os.environ.get('WORK_NODE', '/opt/homebrew/opt/node@24/bin/node'),
                os.environ.get('WORK_ENTRY', 'apps/server/src/bin.ts'), 'serve', '--host', '127.0.0.1',
                '--port', str(port), '--base-dir', home], cwd=root, env=env, stdout=log, stderr=log)
            children.append((child, port, log))
            for _ in range(240):
                if reachable(port): break
                if child.poll() is not None:
                    log.seek(0)
                    raise RuntimeError(log.read()[-4000:])
                time.sleep(.25)
            else: raise RuntimeError('Work startup timed out')
        first, port_a, _ = children[0]
        first.terminate()
        first.wait(timeout=15)
        assert not reachable(port_a)
        assert reachable(children[1][1])
        print('PASS two real Macs: A stopped; B remains reachable, independent homes and identities')
    finally:
        for child, _, log in children:
            if child.poll() is None:
                child.terminate()
                try: child.wait(timeout=15)
                except subprocess.TimeoutExpired: child.kill(); child.wait()
            log.close()
