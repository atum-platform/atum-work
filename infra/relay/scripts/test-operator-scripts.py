"""Offline operator regressions: loopback HTTP only; no Docker/cloud calls."""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

SCRIPTS = Path(__file__).resolve().parent


class OperatorScriptsTests(unittest.TestCase):
    def test_verify_accepts_root_redirect_and_rejects_server_error(self):
        script = (SCRIPTS/'provision-atum.sh').read_text()
        verify = script.split('if [[ "$mode" = --verify ]]; then\n', 1)[1]
        verify = verify.split("<<'JS'\n", 1)[1].split('\nJS\n', 1)[0]
        fixture = """
import {createServer} from 'node:http';
const jwks = {keys: []};
const rootStatus = Number(process.argv[2]);
const server = createServer((req, res) => {
  if (req.url === '/api/work/connect/jwks') {
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(jwks));
  } else if (req.url === '/api/work/connect/assertion') {
    res.writeHead(401); res.end();
  } else if (req.url === '/') {
    res.writeHead(rootStatus, {Location: '/docs'}); res.end();
  } else if (req.url === '/.well-known/oauth-authorization-server') {
    res.end(JSON.stringify({issuer: process.env.ATUM_CONNECT_ASSERTION_AUDIENCE}));
  } else if (req.url === '/health') {
    res.end(JSON.stringify({ok: true}));
  } else {
    res.writeHead(500); res.end('root redirect must not be followed');
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
process.env.ATUM_CONNECT_ASSERTION_ISSUER = origin;
process.env.ATUM_CONNECT_ASSERTION_AUDIENCE = origin;
process.env.ATUM_CONNECT_ASSERTION_JWKS = JSON.stringify(jwks);
try {
"""
        with tempfile.TemporaryDirectory() as directory:
            test = Path(directory)/'verify.mjs'
            test.write_text(fixture + verify + '\n} finally { server.close(); server.closeAllConnections(); }\n')
            for status, expected in [(302, 0), (503, 1)]:
                with self.subTest(status=status):
                    result = subprocess.run([os.environ.get('NODE_BIN', 'node'), str(test), str(status)],
                                            capture_output=True, text=True, timeout=20)
                    self.assertEqual(result.returncode, expected, result.stderr)
                    if status == 302:
                        self.assertIn('VERIFY_OK', result.stdout)
                    else:
                        self.assertIn('Relay unavailable', result.stderr)

    def test_marketplace_compose_uses_staged_kit_subdirectory_and_runtime(self):
        script = (SCRIPTS/'prepare-marketplace-postgres.sh').read_text()
        # Exercise only compose setup, before container lookup and DB/credential writes.
        setup = script.split('container=', 1)[0]
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for name in ['kit', 'runtime']:
                (root/name).mkdir()
            setup = setup.replace('kit=/opt/atum/marketplace-kit/current', f'kit="{root}/kit"')
            setup = setup.replace('runtime=/opt/atum/marketplace-runtime', f'runtime="{root}/runtime"')
            setup = setup.replace('private=/opt/atum/connect-postgres', f'private="{root}/private"')
            # macOS readlink lacks -f on older hosts; revision content is irrelevant here.
            setup = setup.replace('$(basename "$(readlink -f "$kit")")', 'fixture')
            setup += '\nprintf "%s\\n" "$ATUM_MARKETPLACE_RUNTIME" "${dc[@]}"\n'
            test = root/'setup.sh'
            test.write_text(setup)
            result = subprocess.run(['bash', str(test), '--apply'], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(result.stdout.splitlines(), [str(root/'runtime'), 'docker', 'compose',
                '-f', str(root/'kit/deploy/marketplace/compose.yaml'),
                '-f', str(root/'kit/deploy/marketplace/compose.aws.yaml')])


if __name__ == '__main__':
    unittest.main()
