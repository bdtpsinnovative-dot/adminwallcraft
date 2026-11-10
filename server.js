const http = require('http');
const fs = require('fs');
const next = require('next');

const port = parseInt(process.env.PORT, 10) || 8004;
const app = next({ dev: false, dir: __dirname });
const handle = app.getRequestHandler();

const LOG_FILE = 'D:\\server_logs\\8004_adminwallcraft.log';

function writeLog(msg) {
  const line = `[${new Date().toLocaleTimeString('th-TH')}] ${msg}\n`;
  process.stdout.write(line);
  try {
    fs.appendFileSync(LOG_FILE, line);
  } catch {}
}

console.log(`Preparing Next.js production server for WallCraft Admin on port ${port}...`);

app.prepare().then(() => {
  const server = http.createServer((req, res) => {
    const start = Date.now();
    res.on('finish', () => {
      const ms = Date.now() - start;
      if (!req.url.startsWith('/_next/static/') && !req.url.endsWith('.png') && !req.url.endsWith('.ico')) {
        writeLog(`${res.statusCode >= 400 ? '⚠️' : '✅'} HTTP ${res.statusCode} ${req.method} ${req.url} (${ms}ms)`);
      }
    });
    handle(req, res);
  });

  server.listen(port, '0.0.0.0', (err) => {
    if (err) throw err;
    writeLog(`🚀 Server online on http://localhost:${port} -> admin.wallcraftthailand.com`);
  });
}).catch((err) => {
  writeLog(`❌ Error starting server: ${err.message || err}`);
  process.exit(1);
});
