import { fireLaser, opposite } from '../engine';
import type { Color, GameState, PieceType } from '../types';
import { enumerateActions } from './moveGen';

// Pharaoh capture is a terminal state handled by search.ts (±Infinity), not
// scored as material here. Sphinx is never captured. Scarab > anubis >
// pyramid, reflecting how hard each is to remove from the board.
const PIECE_VALUE: Record<PieceType, number> = {
  pharaoh: 0,
  scarab: 30,
  anubis: 20,
  pyramid: 10,
  sphinx: 0,
};

const MOBILITY_WEIGHT = 0.5;
const LASER_HIT_WEIGHT = 25;
const LASER_PHARAOH_WEIGHT = LASER_HIT_WEIGHT * 4;

// Score of firing `fromColor`'s laser right now, from `perspective`'s point
// of view. Positive if it would hit an enemy-of-perspective piece, negative
// if it would hit perspective's own piece (friendly fire) — fireLaser()
// doesn't filter by color, so this check is required.
function laserScoreFor(state: GameState, fromColor: Color, perspective: Color): number {
  const { hit } = fireLaser(state.board, fromColor);
  if (!hit) return 0;
  const weight = hit.piece.type === 'pharaoh' ? LASER_PHARAOH_WEIGHT : LASER_HIT_WEIGHT;
  const hitsEnemy = hit.piece.color !== perspective;
  return hitsEnemy ? weight : -weight;
}

function laserExposure(state: GameState, color: Color): number {
  return laserScoreFor(state, color, color) + laserScoreFor(state, opposite(color), color);
}

function mobility(state: GameState, color: Color): number {
  const mine = enumerateActions(state, color).length;
  const theirs = enumerateActions(state, opposite(color)).length;
  return (mine - theirs) * MOBILITY_WEIGHT;
}

export function evaluate(state: GameState, color: Color): number {
  let material = 0;
  for (const row of state.board) {
    for (const piece of row) {
      if (!piece) continue;
      const value = PIECE_VALUE[piece.type];
      material += piece.color === color ? value : -value;
    }
  }
  return material + mobility(state, color) + laserExposure(state, color);
}
