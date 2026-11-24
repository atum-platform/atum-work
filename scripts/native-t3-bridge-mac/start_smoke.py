"""Start the actual Work server using an empty disposable home and telemetry off."""
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import time
import urllib.request

root = Path(__file__).resolve().parents[2]
with tempfile.TemporaryDirectory(prefix="native-mac-start-") as tmp:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    env = {"PATH": os.environ["PATH"], "HOME": tmp, "T3CODE_HOME": tmp,
           "T3CODE_TELEMETRY_ENABLED": "false", "OTEL_SDK_DISABLED": "true"}
    with tempfile.TemporaryFile(mode="w+") as log:
        child = subprocess.Popen([os.environ.get("WORK_NODE", "/opt/homebrew/opt/node@24/bin/node"),
            os.environ.get("WORK_ENTRY", "apps/server/src/bin.ts"), "serve", "--host", "127.0.0.1", "--port", str(port),
            "--base-dir", tmp], cwd=root, env=env, stdout=log, stderr=log)
        try:
            for _ in range(120):
                if child.poll() is not None:
                    log.seek(0)
                    raise RuntimeError(log.read()[-6000:])
                try:
                    urllib.request.urlopen(f"http://127.0.0.1:{port}/health", timeout=1)
                    print("PASS real Work server started in disposable home; telemetry off")
                    break
                except urllib.error.HTTPError:
                    print("PASS real Work HTTP listener started in disposable home; telemetry off")
                    break
                except OSError:
                    time.sleep(.25)
            else:
                log.seek(0)
                raise RuntimeError(log.read()[-6000:])
        finally:
            child.terminate()
            try:
                child.wait(timeout=15)
            except subprocess.TimeoutExpired:
                child.kill()
                child.wait()
