# Bot AI

The single-player opponent (`src/game/bot/`) is a classic search-based game
engine — minimax with alpha-beta pruning and iterative deepening — plus a
hand-designed evaluation function whose weights were later refined by
self-play. No machine learning, no training data: this was a deliberate
choice to lean into algorithmic depth (search, pruning, tuning) rather than
an ML pipeline, given the scope of the project.

## Difficulty tiers

All three difficulties run the identical search and evaluation code
([`bot.ts`](../src/game/bot/bot.ts)) — only the time budget, a per-tier depth
cap, and score noise differ:

| Difficulty | Time budget | Depth cap | Noise |
|---|---|---|---|
| Easy | 300ms | 1 ply | ±15 (jittered onto the final score) |
| Medium | 1000ms | 2 ply | none |
| Hard | 6000ms | uncapped | none |

A time budget alone barely separates the tiers in practice — this game's
branching factor makes search cost grow roughly 83x per additional ply, so
300ms/1s/6s budgets mostly land at the same depth on typical hardware. The
explicit per-tier depth cap is what actually makes Easy "look one move
ahead" and Medium "look two moves ahead" regardless of the machine it runs
on; only Hard is left uncapped, limited purely by its time budget via
iterative deepening.

Easy's noise is applied once per root candidate move, not per leaf inside
the search — jittering every leaf and taking the max/min over many noisy
samples would systematically inflate scores as a function of subtree size,
which weakens play in an uneven, hard-to-reason-about way. Jittering the
already-computed root score instead keeps the internal search fully correct
and deterministic, and just occasionally prefers a slightly-worse-but-still-
plausible move — "beatable," not "makes obviously bad moves."

## Search: minimax + alpha-beta + iterative deepening

([`search.ts`](../src/game/bot/search.ts))

1. **Move generation** ([`moveGen.ts`](../src/game/bot/moveGen.ts)) enumerates
   every legal action for the side to move, reusing the same rules engine
   the server uses to validate real moves — the bot can't generate a move
   the server would reject.
2. **Minimax** recursively assumes both sides play their best move: the bot
   maximizes its own score, the opponent minimizes it (from the bot's
   perspective), alternating down to the depth limit.
3. **Alpha-beta pruning** cuts off branches that are already provably worse
   than a branch already explored, without changing the result — this is
   what makes searching to depth 3+ tractable at all given the branching
   factor.
4. **Move ordering**: actions that capture a piece are searched first
   (`CAPTURE_ORDER_BONUS`), since exploring the strongest move early
   tightens alpha-beta's pruning the most.
5. **Iterative deepening**: search depth 1, then 2, then 3, ..., committing
   each depth's result only if that *entire* depth finished before the time
   deadline. A depth that got cut off partway through is discarded, not
   committed — its root scores aren't comparable, since some branches got a
   shallower look than others. This is tracked via a `timedOut` flag
   threaded through the whole recursion (not just "was the deadline already
   past when this root move started"), so a deadline hit deep in the tree
   still correctly invalidates that depth's result at the root.

## Evaluation function

([`evaluate.ts`](../src/game/bot/evaluate.ts)) scores a non-terminal
position as a weighted sum of:

- **Material** — piece values (scarab > anubis > pyramid; pharaoh and sphinx
  score 0, since a pharaoh capture is a terminal ±∞ state handled by the
  search, not material, and the sphinx is never capturable).
- **Mobility** — the difference in legal-move count between the two sides.
- **Laser exposure**, split into **offense** (the bot's own laser currently
  threatening an enemy piece) and **defense** (the enemy's laser threatening
  the bot), each independently weighted, and each aware of *friendly fire*
  (`fireLaser()` doesn't filter by color, so a laser hitting your own piece
  scores as a penalty, not a hit).
- **Pharaoh proximity** — a smaller bonus for the bot's laser path merely
  passing *near* the enemy pharaoh even without hitting it this turn, so the
  search has a reason to reposition toward an exposed king instead of only
  valuing an immediate hit.

## Self-play weight tuning

The six tactical weights above (`Weights` in `evaluate.ts`) started as
hand-guessed numbers, then were refined empirically by
[`scripts/tune-bot-weights.ts`](../scripts/tune-bot-weights.ts) — a
standalone, manually-run tool (`npx tsx scripts/tune-bot-weights.ts`), not
wired into the app or CI.

**Algorithm: hill-climbing via self-play.**

1. Start from the current best weight set.
2. Each generation, mutate one randomly-chosen weight by a random ±20–25%
   factor.
3. Play a match between the mutant and the current best — every one of the
   4 built-in starting setups, with the mutant playing *both* colors, each
   repeated 3x with a fresh randomized opening (see below) — and score the
   mutant's win rate.
4. Adopt the mutant as the new "current best" only if it wins by a clear
   margin (>55%); otherwise discard it and mutate from the same base again
   next generation.
5. After 30 generations, print the surviving weight set.

**Why real minimax, not a cheap heuristic.** An earlier version scored each
candidate move with a single call to `evaluate()` at zero depth (no
lookahead) to sidestep injecting a tunable `Weights` object into the
production search, which is hardcoded to `DEFAULT_WEIGHTS`. That approach
turned out to be structurally broken: with no lookahead, moves are picked
before any laser-exposure or proximity signal exists (those terms are
usually zero while pieces still block sightlines), so games never engaged —
they ran out a ply cap as draws regardless of which weights were being
compared. The fix was adding an optional `weights` parameter to `search()`
itself (default-argument, so every existing call site is unaffected), so the
tuner drives the *same* minimax search the production bot uses, just with a
candidate weight set injected.

**Why randomized openings.** With real search, a second problem showed up:
some of the 4 mirrored starting setups resolve via a forced tactical
sequence the search finds regardless of the evaluation weights (a forced win
scores ±∞, bypassing `evaluate()` entirely) — so weight tuning had no say
over those setups' outcomes at all. Randomizing the first several plies with
uniformly random legal moves (weight-independent, both sides) breaks that
determinism, so each generation actually samples a different mid-game
instead of replaying the same fixed forced line every time.

**Why each matchup is replayed 3x.** A single 8-game match (4 setups × 2
colors) has enough variance that a mutation could clear the 55% adoption bar
by luck — several early tuning runs adopted mutations that won by exactly
4.5/8 games, a margin well within noise for that sample size. Replaying each
setup/color combination 3 times (24 games/match) with a fresh random opening
each time gives the adoption decision a real statistical margin to stand on.

The weight set currently in `DEFAULT_WEIGHTS` is the result of one such
30-generation run; re-running the script (a few hours on a modern laptop —
it's a plain single-threaded CPU workload, no GPU involved) will find a
different, not-necessarily-better set, since it's a randomized local search,
not a deterministic optimizer.
