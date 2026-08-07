# ⚡ Laser Chess — Online (Next.js + TypeScript)

A real-time, online-multiplayer **Laser Chess** (Khet-style) game. Create a game,
share the link, and a friend joins straight from the URL. Deflect your laser
through mirrors to burn the enemy **Pharaoh**.

- 🧩 **Next.js (App Router) + React 19 + TypeScript** — proper structure, room to grow a backend.
- 🎯 **Authoritative game server** over WebSockets — rules & laser physics resolved server-side.
- 🔗 Shareable game links (`/?game=CODE`) + spectators + reconnect-on-refresh.
- 🎨 Warm, hand-drawn **line-art** look (cream board, ink outlines, coral & teal pieces).
- ✨ Smooth, non-laggy laser animation on three stacked canvases (per-frame work stays tiny).
- 🗺️ Four starting positions: **Classic, Imhotep, Dynasty, Ambush** (all perfectly mirror-symmetric).
- 📱 Works on desktop and touch.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000  (hot reload)
```

Production:

```bash
npm run build
npm start            # NODE_ENV=production
```

`npm run typecheck` runs `tsc --noEmit`. Set `PORT` to change the port.

- Click **Create game & get share link**, copy the link/room code from the side panel,
  and send it to a friend. They open it, type a name, hit **Join** — the game begins.
- Open the link in a second browser tab to test locally (each tab is its own player).
- To play over the internet, deploy to any **Node host** (Railway, Render, Fly, a VPS)
  or expose the port with a tunnel (`ngrok http 3000`). See **Deploying** below.

## Deploying

This app needs a **persistent Node process** (a long-running "web service") because it
holds live WebSocket connections and keeps game rooms in memory. It is **not**
compatible with serverless platforms like **Vercel / Netlify functions**, nor with
**Firebase** (Hosting is static-only; Functions are serverless) — they ignore the custom
[`server.mts`](server.mts), can't hold WebSockets open, and have a read-only filesystem.
You need a host that keeps a Node process alive. **This guide targets Render's free
tier**; Fly.io, Koyeb, a VPS, or an Oracle Cloud always-free VM work the same way.

**This repo is already deploy-ready:** `tsx` + `cross-env` are in `dependencies` (so the
server starts even on production-only installs), Node is pinned to `22` via
`.node-version`, and a [`render.yaml`](render.yaml) blueprint is included.

**Build & start commands** (already set in `render.yaml`; use these if configuring manually):

| Step | Command |
|---|---|
| Install | `npm install --include=dev`  *(devDeps are needed for `next build`)* |
| Build | `npm run build` |
| Start | `npm start`  *(= `NODE_ENV=production tsx server.mts`; reads `PORT` from env)* |

**3) Environment variables:**

| Var | Set it? | Purpose |
|---|---|---|
| `ADMIN_PASSWORD` | **yes** | Admin login password (defaults to `laserchess` if unset). |
| `AUTH_SECRET` | **yes** | Pins the cookie-signing secret so admin logins survive restarts/redeploys. Use a long random string. |
| `NODE_ENV` | auto | The start script sets `production`; this also marks the admin cookie `secure` (needs HTTPS). |
| `PORT` | auto | Injected by the host; the server reads it. |

**4) Node 20+** (22 recommended). Pin it with a `.node-version` file containing `22`, or
the host's Node setting.

**5) Run a SINGLE instance.** Game rooms live in memory in the one process — do **not**
enable horizontal autoscaling / multiple replicas, or two players in a room could land on
different instances and not see each other. One instance easily handles casual play.

**6) Persistence (optional).** `admins.json` is committed and read at startup (edit it +
redeploy to change who's an admin). Runtime writes go to `./data`
(`setups.json`, `adminSecret.json`). On ephemeral PaaS filesystems this resets on each
deploy, so:
- Setting `AUTH_SECRET` (step 3) keeps admin sessions valid even when `data/` is wiped.
- To keep **saved custom setups** across redeploys, attach a **persistent volume** mounted
  at the app's `data` directory (Render Disks / Railway Volumes / Fly Volumes). Otherwise
  the 4 built-in setups always work and custom ones reset on deploy.

**7) HTTPS is automatic** on these hosts; the browser then connects `wss://<your-domain>/ws`
by itself (the client uses the same origin), and the `secure` admin cookie works. No
WebSocket URL configuration needed.

### Deploy to Render (free) — step by step

**Prerequisite:** push this project to a **GitHub** (or GitLab) repo — Render deploys from Git.

```bash
git init && git add -A && git commit -m "Laser Chess"
# create an empty repo on GitHub, then:
git remote add origin https://github.com/<you>/laser-chess.git
git branch -M main && git push -u origin main
```

**Easiest — Blueprint (uses [`render.yaml`](render.yaml)):**
1. [dashboard.render.com](https://dashboard.render.com) → **New +** → **Blueprint**.
2. Connect your repo — Render reads `render.yaml` and proposes a **Free** web service.
3. It prompts for **`ADMIN_PASSWORD`** — enter a strong password (`AUTH_SECRET` is auto-generated).
4. **Apply** → wait for the first build (~2–3 min) → open the `https://<name>.onrender.com` URL.

**Or set it up manually:**
1. **New +** → **Web Service** → connect the repo.
2. **Instance Type: Free**. Build command `npm install --include=dev && npm run build`, Start command `npm start`.
3. **Environment** → add `ADMIN_PASSWORD` (your password) and `AUTH_SECRET` (a long random string). `NODE_ENV` and `PORT` are handled for you.
4. **Create Web Service** → open the URL. Multiplayer and `/admin` work over HTTPS.

**Free-tier caveats (all fine for casual play):**
- The service **sleeps after ~15 min idle**; the next visit waits ~30–60 s to wake, and an idle in-progress game (kept in memory) resets when it sleeps.
- Free services have **no persistent disk**, so saved custom setups reset on redeploy/sleep — the 4 built-in setups always work, and `AUTH_SECRET` keeps admin logins valid through restarts.
- **Change admins later:** edit [`admins.json`](admins.json) and `git push` (Render auto-deploys). **Change the password:** update the `ADMIN_PASSWORD` env var in the dashboard.
- Keep it a **single instance** (the free plan is single by default — don't add scaling).

## Architecture

This uses a **custom Next.js server** ([`server.mts`](server.mts)) so we can hold
WebSocket connections open — something Next's serverless request handlers can't do.
Next handles all HTTP (the app, static assets, and any future `app/api/*` route
handlers); we attach the game server on `/ws`.

```
server.mts                     custom server: Next request handler + WebSocket upgrade
src/
  game/                        ── shared, pure, isomorphic (server + browser) ──
    types.ts                   domain types
    engine.ts                  rules: pieces, moves, laser tracing, win detection
    setups.ts                  the four starting positions (red defined, silver mirrored)
    messages.ts                the client⇄server wire protocol (typed)
  server/
    gameServer.ts              authoritative rooms + WebSocket handling
  lib/
    render.ts                  layered-canvas renderer + all animations (browser)
    net.ts                     WebSocket client with auto-reconnect
  client/
    controller.ts             framework-agnostic game logic + immutable view store
    useController.ts          React hook (useSyncExternalStore) over the controller
  components/
    Lobby.tsx  GamePlay.tsx  Board.tsx  Toast.tsx
  app/
    layout.tsx  page.tsx  globals.css  icon.svg
```

`src/game/*` is imported unchanged by **both** the server and the browser bundle, so
the rules can never drift between the two. The imperative canvas `Renderer` lives
outside React (owned by the `GameController`) to keep animations perfectly smooth,
while React subscribes to a small immutable view snapshot via `useSyncExternalStore`.

### Where a future backend plugs in

- **REST/DB**: add `src/app/api/**/route.ts` handlers (matchmaking, profiles, history).
- **Persistence**: swap the in-memory `rooms` map in `gameServer.ts` for Redis/Postgres.
- **Auth**: gate `onJoin` with a session; `playerId` already threads through.

## Admin: edit starting configurations

Visit **`/admin`** (or click **"Edit starting configurations"** in the lobby) for a
visual board editor:

- Pick a **brush** (colour + piece type, or Erase), then **click a square** to place.
  Click a matching piece to **rotate** it 90°; click with a different brush to replace.
- **Mirror Red→Silver / Silver→Red** to build a symmetric board in one click.
- Live **validation** shows piece counts and — importantly — whether the **opening
  laser is safe** (destroys nothing), so you can't ship a config where a player loses
  material without moving.
- **Save** it (any name); it immediately appears in the lobby's Board dropdown and is
  used by real games. **Load** or **delete** existing configs. Saving over a built-in
  name (e.g. `Classic`) overrides it.

Custom setups persist to `data/setups.json` (git-ignored) and are read by the
authoritative game server via [`src/server/setupStore.ts`](src/server/setupStore.ts).
The endpoint is [`/api/setups`](src/app/api/setups/route.ts) — `GET` is public (the
lobby needs the list); `POST`/`DELETE` require an admin session.

### Admin authentication

The editor is protected by a password login gated to an **email allowlist**:

- **[`admins.json`](admins.json)** (project root) lists the authorized emails. Add or
  remove emails here — removing one immediately revokes any active session.
- The password is the **`ADMIN_PASSWORD`** env var, or the default **`laserchess`** if
  unset (the server logs a reminder on startup). Set it for anything non-local:

  ```bash
  ADMIN_PASSWORD='your-strong-password' npm start
  ```

- On success the server issues a signed, httpOnly session cookie (HMAC-SHA256, 7-day
  expiry) — see [`src/server/adminAuth.ts`](src/server/adminAuth.ts). Auth routes:
  [`/api/admin/login`](src/app/api/admin/login/route.ts), `/api/admin/logout`,
  `/api/admin/me`. No external service or dependency (just `node:crypto`).
- The cookie secret is a random value persisted to `data/adminSecret.json` (git-ignored),
  or set **`AUTH_SECRET`** to pin it. Cookies are marked `secure` in production (serve
  over HTTPS).

Only an email in `admins.json` **and** the correct password can log in; the write API
returns `401` for everyone else.

## How to play

Each turn you either **move** a piece one square (any of 8 directions) **or rotate**
it 90°. Then **your laser fires automatically** from your Sphinx. Any piece struck on
a non-mirrored face is destroyed. Hit the enemy Pharaoh to win — but beware hitting
your own!

| Piece | Behaviour |
|-------|-----------|
| **Pharaoh** | Your king. If any laser hits it, you lose. |
| **Pyramid** | One mirror — deflects the beam 90°. Struck on a flat side → destroyed. |
| **Scarab** | Double mirror — always deflects, never dies. May swap with an adjacent Pyramid/Anubis. |
| **Anubis** | Shielded on its bright front face; struck from side/back → destroyed. |
| **Sphinx** | Your laser cannon, fixed in the corner. You can only rotate it. |

**Controls:** tap a piece → tap a gold dot to move, or a ↻ handle to rotate.
The two sides are **Red** and **Teal**; Teal moves first. (Internally the teal side
is still called `silver` in the code/protocol.)
