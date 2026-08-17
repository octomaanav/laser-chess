import { fireLaser, opposite } from '../engine';
import type { Color, GameState, PieceType } from '../types';
import { enumerateActions } from './moveGen';

// Keystone capture is a terminal state handled by search.ts (±Infinity), not
// scored as material here. Source is never captured. Prism > shield >
// mirror, reflecting how hard each is to remove from the board. Not part
// of Weights/tuning - these reflect known game rules, not a guess.
const PIECE_VALUE: Record<PieceType, number> = {
  keystone: 0,
  prism: 30,
  shield: 20,
  mirror: 10,
  source: 0,
};

// The tunable tactical weights - see scripts/tune-bot-weights.ts for the
// self-play search that produced DEFAULT_WEIGHTS's values.
export interface Weights {
  mobility: number;
  offenseHit: number;
  offenseKeystone: number;
  defenseHit: number;
  defenseKeystone: number;
  keystoneProximity: number;
  keystoneDangerProximity: number;
}

// Found by scripts/tune-bot-weights.ts: 30-generation self-play
// hill-climbing (24 games/generation, real minimax at depth 3, randomized
// openings), started from an initial hand-guessed set and kept only
// mutations that beat the running best by a clear margin.
export const DEFAULT_WEIGHTS: Weights = {
  mobility: 0.32432561407197136,
  offenseHit: 29.339335407882885,
  offenseKeystone: 128.3714831533795,
  defenseHit: 24.169067198840033,
  defenseKeystone: 84.6165330491138,
  keystoneProximity: 8.778894268321732,
  keystoneDangerProximity: 8.778894268321732,
};

// Board is 10 wide (x 0..9) x 8 tall (y 0..7); this bounds any Manhattan
// distance on it.
const MAX_LASER_DISTANCE = 10 + 8;

// Score of firing `fromColor`'s laser right now, from `perspective`'s point
// of view. Positive if it would hit an enemy-of-perspective piece, negative
// if it would hit perspective's own piece (friendly fire) - fireLaser()
// doesn't filter by color, so this check is required.
function laserScoreFor(
  state: GameState,
  fromColor: Color,
  perspective: Color,
  hitWeight: number,
  keystoneWeight: number,
): number {
  const { hit } = fireLaser(state.board, fromColor);
  if (!hit) return 0;
  const weight = hit.piece.type === 'keystone' ? keystoneWeight : hitWeight;
  const hitsEnemy = hit.piece.color !== perspective;
  return hitsEnemy ? weight : -weight;
}

function laserExposure(state: GameState, color: Color, weights: Weights): number {
  const offense = laserScoreFor(state, color, color, weights.offenseHit, weights.offenseKeystone);
  const defense = laserScoreFor(state, opposite(color), color, weights.defenseHit, weights.defenseKeystone);
  return offense + defense;
}

function findKeystone(state: GameState, color: Color): { x: number; y: number } | null {
  for (let y = 0; y < state.board.length; y++) {
    for (let x = 0; x < state.board[y].length; x++) {
      const piece = state.board[y][x];
      if (piece?.type === 'keystone' && piece.color === color) return { x, y };
    }
  }
  return null;
}

// Scores `laserOwner`'s laser path passing near `targetKeystoneColor`'s
// keystone even when it doesn't hit it this turn, so the search prefers
// closing the distance over an aimless move — without this, only an
// immediate hit had any value, so pressure never built up gradually. Skipped
// when the laser already hits the keystone (laserExposure's keystone weight
// covers that case). Used both ways: `color`'s laser vs. the enemy keystone
// (offense, rewarded) and the enemy's laser vs. `color`'s own keystone
// (defense, penalized) — without the defensive direction, a laser two moves
// from lining up on your own king scored identically to one pointed
// harmlessly away, since only an exact hit registered.
function laserProximityBonus(
  state: GameState,
  laserOwner: Color,
  targetKeystoneColor: Color,
  weight: number,
): number {
  const { path, hit } = fireLaser(state.board, laserOwner);
  if (hit?.piece.type === 'keystone') return 0;
  const targetKeystone = findKeystone(state, targetKeystoneColor);
  if (!targetKeystone || path.length === 0) return 0;

  let minDist = Infinity;
  for (const point of path) {
    const dist = Math.abs(point.x - targetKeystone.x) + Math.abs(point.y - targetKeystone.y);
    if (dist < minDist) minDist = dist;
  }
  if (!Number.isFinite(minDist)) return 0;
  return weight * (1 - minDist / MAX_LASER_DISTANCE);
}

function mobility(state: GameState, color: Color, weights: Weights): number {
  const mine = enumerateActions(state, color).length;
  const theirs = enumerateActions(state, opposite(color)).length;
  return (mine - theirs) * weights.mobility;
}

export function evaluate(state: GameState, color: Color, weights: Weights = DEFAULT_WEIGHTS): number {
  let material = 0;
  for (const row of state.board) {
    for (const piece of row) {
      if (!piece) continue;
      const value = PIECE_VALUE[piece.type];
      material += piece.color === color ? value : -value;
    }
  }
  return (
    material +
    mobility(state, color, weights) +
    laserExposure(state, color, weights) +
    laserProximityBonus(state, color, opposite(color), weights.keystoneProximity) -
    laserProximityBonus(state, opposite(color), color, weights.keystoneDangerProximity)
  );
}
