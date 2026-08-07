// Custom Next.js server. Next handles all HTTP (pages, assets, API routes),
// while we route `/ws` WebSocket upgrades to the authoritative game server —
// something Next's serverless handlers can't do. Non-`/ws` upgrades (Next's
// dev HMR socket) are forwarded to Next.
import { createServer } from 'node:http';
import next from 'next';
import { createGameWss } from './src/server/gameServer';

const dev = process.env.NODE_ENV !== 'production';
const port = Number(process.env.PORT || 3000);

const app = next({ dev });

await app.prepare();

const handle = app.getRequestHandler();
const upgradeNext = typeof app.getUpgradeHandler === 'function' ? app.getUpgradeHandler() : null;

const server = createServer((req, res) => {
  handle(req, res);
});

const gameWss = createGameWss();

server.on('upgrade', (req, socket, head) => {
  const pathname = (req.url || '').split('?')[0];
  if (pathname === '/ws') {
    gameWss.handleUpgrade(req, socket, head, (ws) => gameWss.emit('connection', ws, req));
  } else if (upgradeNext) {
    upgradeNext(req, socket, head);
  } else {
    socket.destroy();
  }
});

server.listen(port, () => {
  console.log(`\n  ⚡ Laser Chess ${dev ? '(dev)' : ''} running at  http://localhost:${port}`);
  if (!process.env.ADMIN_PASSWORD) {
    console.log('  🔑 Admin password is the default "laserchess" — set ADMIN_PASSWORD to change it.');
  }
  console.log('');
});
