# Architecture

This goes deeper than the README's overview - the design decisions behind the
realtime server, the rendering pipeline, persistence, and auth, and the
tradeoffs each one made. For the bot AI engine specifically, see
[`bot-ai.md`](./bot-ai.md).

## Authoritative WebSocket server

Real-time games need a long-lived connection, and every move needs to be
checked against the real rules before it reaches the other player - a client
can't be trusted to only ever send legal moves.

**Why a custom server, not `next dev`/serverless.** Next.js API routes and
Vercel-style serverless functions are request/response - they can't hold a
socket open. [`server.mts`](../server.mts) wraps Next.js in a plain
`http.Server`: normal HTTP requests go to Next's request handler unchanged,
and `upgrade` events for `/ws` are routed to
[`src/server/gameServer.ts`](../src/server/gameServer.ts); every other
upgrade (Next's own HMR websocket) forwards to Next's handler. This is the
one piece of infrastructure the app can't get from a hosted framework alone.

**Why the server re-runs the rules, not just relays messages.** A naive
implementation would trust the client's move and broadcast it. Instead every
incoming move calls `applyAction()` from [`src/game/engine.ts`](../src/game/engine.ts)
- the same pure rules module the browser uses to preview legal moves - and
the server only broadcasts the `ApplyResult` it computed itself. The client's
own prediction is just an animation preview; it's discarded and replaced by
whatever the server actually resolved. This is what makes the "one shared
rules module" README bullet load-bearing rather than cosmetic: since both
sides import the exact same code, there's no separate "server rules" and
"client rules" to keep in sync, and no way for a client to claim a move
happened that the engine wouldn't allow.

**Room state lives in memory, not a database**, keyed by a short room code
(`Map<string, Room>` in `gameServer.ts`). A `Room` holds the `GameState`,
both seats, connected `Client`s, per-move timers, and rematch votes. This
keeps the common case (two people mid-game) fast and simple - no DB
round-trip per move - at the cost of needing an explicit persistence path
(next section) for anything that has to survive a process restart.

**Disconnect handling** is a deliberate UX choice, not just a socket-close
handler: a disconnected player gets `DISCONNECT_FORFEIT_MS` (90s default) to
reconnect before the game auto-forfeits, so a flaky connection or an
accidental tab close doesn't instantly lose the game. The controller
(`src/client/controller.ts`) pairs this with reconnect-on-visibility-change,
so backgrounding a mobile browser and coming back doesn't need a manual
reconnect click.

## Isomorphic rules, imperative rendering

`src/game/` has no imports outside itself - no React, no `ws`, no Node APIs
- so it runs unmodified in both the server process and the browser bundle.
That single constraint is what guarantees the client's move preview and the
server's authoritative result can never structurally diverge; they're
literally the same function.

Rendering deliberately sits *outside* React's render cycle.
[`src/lib/render.ts`](../src/lib/render.ts) owns three stacked `<canvas>`
layers (board / pieces / effects) and drives its own `requestAnimationFrame`
loop for the 60fps travelling laser beam and explosions. React
(`Board.tsx`, `GamePlay.tsx`) hands it one immutable state snapshot per
update and never touches the canvas again until the next snapshot - a 60fps
animation loop fighting React's reconciler for the same frame budget is a
common source of jank, so the two are kept structurally separate rather than
papered over with `useEffect` timing tricks.

## Persistence: one interface, two backends

[`src/server/store/`](../src/server/store) defines a single `Store`
interface ([`types.ts`](../src/server/store/types.ts)) with two
implementations picked by `store/index.ts` at process start: `PgStore`
(Postgres, when `DATABASE_URL` is set) or `FileStore` (local JSON files,
zero-config). This exists so the same room/setup/admin-secret persistence
code runs identically in local dev (no database to stand up) and in
production (a real Postgres instance, so an in-progress game survives a
redeploy or the host putting the app to sleep). The tradeoff: any change to
what gets persisted has to be implemented twice, once per backend, since
there's no ORM abstracting the difference away - a deliberate choice to keep
each implementation simple and inspectable rather than pull in a query
builder for two small backends.

## Two independent auth systems

`src/server/auth/` (player accounts: email/password via `node:crypto`,
Google/GitHub OAuth via a plain `fetch` authorization-code flow, a session
cookie) and `src/server/adminAuth.ts` (the `/admin` board editor's
single-password login) do not share code or sessions. They solve different
problems - a player's account is optional and only affects display name; the
admin login gates a completely separate surface (custom setup editing) that
has nothing to do with playing games - so merging them would couple two
things that have no reason to change together.
