import { fireLaser, opposite } from '../engine';
import type { Color, GameState, PieceType } from '../types';
import { enumerateActions } from './moveGen';

// Pharaoh capture is a terminal state handled by search.ts (±Infinity), not
// scored as material here. Sphinx is never captured. Scarab > anubis >
// pyramid, reflecting how hard each is to remove from the board. Not part
// of Weights/tuning - these reflect known game rules, not a guess.
const PIECE_VALUE: Record<PieceType, number> = {
  pharaoh: 0,
  scarab: 30,
  anubis: 20,
  pyramid: 10,
  sphinx: 0,
};

// The tunable tactical weights - see scripts/tune-bot-weights.ts for the
// self-play search that produced DEFAULT_WEIGHTS's values.
export interface Weights {
  mobility: number;
  offenseHit: number;
  offensePharaoh: number;
  defenseHit: number;
  defensePharaoh: number;
  pharaohProximity: number;
}

// Found by scripts/tune-bot-weights.ts: 30-generation self-play
// hill-climbing (24 games/generation, real minimax at depth 3, randomized
// openings), started from an initial hand-guessed set and kept only
// mutations that beat the running best by a clear margin.
export const DEFAULT_WEIGHTS: Weights = {
  mobility: 0.32432561407197136,
  offenseHit: 29.339335407882885,
  offensePharaoh: 128.3714831533795,
  defenseHit: 24.169067198840033,
  defensePharaoh: 84.6165330491138,
  pharaohProximity: 8.778894268321732,
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
  pharaohWeight: number,
): number {
  const { hit } = fireLaser(state.board, fromColor);
  if (!hit) return 0;
  const weight = hit.piece.type === 'pharaoh' ? pharaohWeight : hitWeight;
  const hitsEnemy = hit.piece.color !== perspective;
  return hitsEnemy ? weight : -weight;
}

function laserExposure(state: GameState, color: Color, weights: Weights): number {
  const offense = laserScoreFor(state, color, color, weights.offenseHit, weights.offensePharaoh);
  const defense = laserScoreFor(state, opposite(color), color, weights.defenseHit, weights.defensePharaoh);
  return offense + defense;
}

function findPharaoh(state: GameState, color: Color): { x: number; y: number } | null {
  for (let y = 0; y < state.board.length; y++) {
    for (let x = 0; x < state.board[y].length; x++) {
      const piece = state.board[y][x];
      if (piece?.type === 'pharaoh' && piece.color === color) return { x, y };
    }
  }
  return null;
}

// Rewards `color`'s laser path passing near the enemy pharaoh even when it
// doesn't hit it this turn, so the search prefers repositioning the laser
// toward an exposed king over an aimless safe move - without this, only an
// immediate hit had any value, so the bot never built up pressure. Skipped
// when the laser already hits the pharaoh (laserExposure's pharaoh weight
// covers that case).
function pharaohProximityBonus(state: GameState, color: Color, weights: Weights): number {
  const { path, hit } = fireLaser(state.board, color);
  if (hit?.piece.type === 'pharaoh') return 0;
  const enemyPharaoh = findPharaoh(state, opposite(color));
  if (!enemyPharaoh || path.length === 0) return 0;

  let minDist = Infinity;
  for (const point of path) {
    const dist = Math.abs(point.x - enemyPharaoh.x) + Math.abs(point.y - enemyPharaoh.y);
    if (dist < minDist) minDist = dist;
  }
  if (!Number.isFinite(minDist)) return 0;
  return weights.pharaohProximity * (1 - minDist / MAX_LASER_DISTANCE);
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
    pharaohProximityBonus(state, color, weights)
  );
}
