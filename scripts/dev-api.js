'use strict';

/**
 * Local development only: serves the Vercel functions in api/ on
 * http://localhost:3010 so `npm start` (which proxies /api via the "proxy"
 * field in package.json) can talk to them without the Vercel CLI.
 *
 *   npm run dev:api        # terminal 1
 *   npm start              # terminal 2
 */

const http = require('http');
const path = require('path');
const fs = require('fs');

for (const file of ['.env.local', '.env']) {
  const fullPath = path.join(__dirname, '..', file);
  if (fs.existsSync(fullPath)) process.loadEnvFile(fullPath);
}

const PORT = Number(process.env.DEV_API_PORT || 3010);

// CRA's proxy rewrites Origin to the proxy target and sets X-Forwarded-Host to
// the dev server, so allow those local origins (dev only).
if (!process.env.ALLOWED_ORIGINS) {
  const ports = [PORT, 3000, 3001, 3002, 3003];
  process.env.ALLOWED_ORIGINS = ports
    .flatMap((port) => [`http://localhost:${port}`, `http://127.0.0.1:${port}`])
    .join(',');
}

const soccerHandler = require('../api/soccer');
const soccerAvatarHandler = require('../api/soccer-avatar');

http
  .createServer((req, res) => {
    const { pathname } = new URL(req.url, 'http://localhost');
    if (pathname === '/api/soccer') return soccerHandler(req, res);
    if (pathname === '/api/soccer-avatar') return soccerAvatarHandler(req, res);
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: { code: 'not_found', message: 'Not found.' } }));
  })
  .listen(PORT, () => {
    console.log(`[dev-api] /api/soccer listening on http://localhost:${PORT}`);
  });
