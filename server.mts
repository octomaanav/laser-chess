// Custom Next.js server. Next handles all HTTP (pages, assets, API routes),
// while we route `/ws/<game>` WebSocket upgrades to that game's authoritative
// server - something Next's serverless handlers can't do. Other upgrades (Next's
// dev HMR socket) are forwarded to Next.
import { createServer } from 'node:http';
import next from 'next';
import { GAME_WSS } from './src/server/games';
import { socialHub } from './src/server/social/socialHub';
import { matchmakingQueue } from './src/server/matchmaking';

const dev = process.env.NODE_ENV !== 'production';
const port = Number(process.env.PORT || 3000);

const app = next({ dev });

await app.prepare();

const handle = app.getRequestHandler();
const upgradeNext = typeof app.getUpgradeHandler === 'function' ? app.getUpgradeHandler() : null;

const server = createServer((req, res) => {
  handle(req, res);
});

server.on('upgrade', (req, socket, head) => {
  const pathname = (req.url || '').split('?')[0];
  if (pathname === '/ws/social') {
    socialHub.handleUpgrade(req, socket, head);
    return;
  }
  const slug = /^\/ws\/([a-z0-9-]+)$/.exec(pathname)?.[1];
  const wss = slug ? GAME_WSS[slug] : undefined;
  if (wss) {
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  } else if (upgradeNext) {
    upgradeNext(req, socket, head);
  } else {
    socket.destroy();
  }
});

const mmTick = setInterval(() => matchmakingQueue.tick(), 3000);
server.on('close', () => clearInterval(mmTick));

server.listen(port, () => {
  console.log(`Game Night ${dev ? '(dev)' : ''} running at http://localhost:${port}`);
  if (!process.env.ADMIN_PASSWORD) {
    if (dev) console.log('Admin password is the default "laserchess" (set ADMIN_PASSWORD to change it)');
    else console.log('ADMIN_PASSWORD is not set (admin login is disabled until configured)');
  }
});
