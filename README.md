# ⚡ Laser Chess

**Real-time, online-multiplayer Laser Chess:** a Khet-style strategy game where you
rotate mirrors to bend a laser across the board and burn your opponent's Pharaoh.
Share a link and play a friend in the browser: no install, no account.

[**▶ Live demo**](https://laser-chess-n6nu.onrender.com) &nbsp;·&nbsp;

![Next.js](https://img.shields.io/badge/Next.js-15-000?logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![WebSockets](https://img.shields.io/badge/WebSockets-realtime-1f8b4c)

![Gameplay](docs/game.png)

## Features

- **Online multiplayer** over WebSockets - create a game, share the link, and an opponent
  joins straight from the URL. Includes spectators, live presence, and reconnect-on-refresh.
- **Authoritative server** - every move and the full laser trace is resolved server-side,
  so game state can't be tampered with from the client.
- **One shared game engine** - the rules (movement, mirror reflection, win detection) live
  in a single isomorphic TypeScript module used by *both* the server and the browser, so
  they can never drift out of sync.
- **Smooth 60 fps canvas rendering** - layered canvases and a hand-tuned animation loop
  keep the travelling laser beam and explosions fluid. No game or graphics libraries.
- **Sleek dark-neon UI** - a cohesive "laser" design system (Tailwind CSS + shadcn/ui) with an
  electric-cyan accent that adapts to desktop and mobile.
- **Built-in board editor** - a small admin tool to visually design and validate custom
  starting positions, with a live "is the opening safe?" check.
- **Durable persistence (optional Postgres)** - custom setups, the admin secret, and
  *in-progress games* are written through to a database, so configurations and live matches
  survive a redeploy/restart. Falls back to local files with zero setup in development.
- **Optional accounts** - sign up with email + password, Google, or GitHub to get a unique
  `@username`. Accounts are the foundation for the planned online matchmaking; quick
  share-a-link games stay fully anonymous and need no sign-in.

## Tech stack

`Next.js (App Router)` · `React 19` · `TypeScript` · `Tailwind CSS` · `shadcn/ui` · custom `Node` server · `ws` (WebSockets) · HTML5 `Canvas`

The rules engine, the renderer, and the networking are all written from scratch - no chess/game
engine and no realtime SaaS.

## How it works

The interesting engineering lives in three places:

- **Custom server + WebSockets.** Next.js is wrapped by a custom Node server
  ([`server.mts`](server.mts)) so it can hold long-lived WebSocket connections for real-time
  play - something serverless functions can't do. `/ws` upgrades route to the game server;
  everything else is handled by Next.
- **Isomorphic, authoritative rules.** [`src/game/`](src/game) is pure and dependency-free.
  The server uses it to validate moves and trace the laser; the browser imports the *same*
  code to show legal moves and drive animations. The server stays the source of truth.
- **Imperative rendering, outside React.** The canvas renderer
  ([`src/lib/render.ts`](src/lib/render.ts)) owns three stacked layers (board / pieces /
  effects) and runs its own `requestAnimationFrame` loop, so 60 fps laser animations never
  fight React's render cycle. React just subscribes to a small immutable view snapshot.
- **A search-based bot opponent.** Minimax with alpha-beta pruning and iterative deepening,
  with an evaluation function tuned by self-play hill-climbing rather than hand-guessing.
  See [`docs/bot-ai.md`](docs/bot-ai.md).

More on the realtime server, persistence, and auth design: [`docs/architecture.md`](docs/architecture.md).

```
src/
  game/        shared, pure rules - engine, starting positions, types, wire protocol
  server/      authoritative WebSocket game server, rooms, auth (accounts + admin), storage (file/Postgres)
  lib/         canvas renderer + network client
  client/      framework-agnostic game controller (+ a React hook over it)
  components/   React UI
  app/         Next.js App Router - pages and API routes
server.mts     custom server: Next request handler + WebSocket upgrade routing
```

## Run locally

```bash
npm install
npm run dev        # http://localhost:3030
```

To play both sides locally, open the game in a normal window **and** an incognito
window (each needs its own identity - two tabs in the same window share one player,
which is what lets you close/reopen a tab and reconnect to your seat).

## How to play

Each turn, **move** a piece one square (any direction) **or rotate** it 90°; then your laser
fires automatically from your Sphinx. A piece struck on a non-mirror face is destroyed -
hit the enemy Pharaoh to win.

| Piece | Behaviour |
|---|---|
| **Pharaoh** | Your king - if any laser hits it, you lose. |
| **Pyramid** | One mirror; deflects the beam 90°. |
| **Scarab** | Double mirror; always deflects, never destroyed. |
| **Anubis** | Shielded in front; vulnerable from the side or back. |
| **Sphinx** | Your laser cannon in the corner (rotate only). |

Four built-in starting positions ship with the game, and you can design your own in the editor:

![Board editor](docs/editor.png)

## Accounts & sign-in (optional)

Accounts are optional and exist to power the planned online matchmaking - anyone can still
create/join quick games by link or code without signing in. A signed-in player gets a unique
`@username` and plays under their account's display name.

Sign-in methods are self-contained (`node:crypto` for password hashing and the session cookie;
OAuth is the plain authorization-code flow over `fetch`, no SDK):

- **Email + password** - works out of the box, no configuration.
- **Google / GitHub** - enabled per provider only when its credentials are set. Register the
  callback URL `<your-origin>/api/auth/oauth/<provider>/callback` with the provider.

Manage your profile at `/account`; the admin board editor at `/admin` is a separate login.
