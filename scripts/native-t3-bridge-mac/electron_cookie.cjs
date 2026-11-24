// Run with Electron, with ELECTRON_RUN_AS_NODE unset. No owner partition or window.
const { app, session } = require('electron');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'native-electron-cookie-'));
app.setPath('userData', root);
app.setPath('sessionData', root);
app.whenReady().then(async () => {
  app.dock?.hide();
  const server = http.createServer((req, res) => res.end(JSON.stringify({ cookie: req.headers.cookie })));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const client = session.fromPartition('native-oauth-decoy-proof');
    const response = await client.fetch(`http://127.0.0.1:${server.address().port}`, {
      headers: { cookie: 'native=decoy' }, redirect: 'error'
    });
    if ((await response.json()).cookie !== 'native=decoy') throw new Error('Explicit Cookie was not preserved');
    console.log('PASS real Electron session.fetch preserves native approval cookie channel');
  } finally {
    await new Promise(resolve => server.close(resolve));
    app.quit();
  }
}).catch(error => { console.error(error.message); app.exit(1); });
