// 16 rank levels stored as an integer index: 0 = Bronze 1, 14 = Diamond 3, 15 = Master.
// Win → index + 1 (max 15), Loss → index - 1 (min 0).
// No Elo formula — every game moves you exactly one sub-rank.

export const DEFAULT_RATING = 3; // Silver 1
export const MAX_RATING = 15;    // Master

export interface RankInfo {
  tier: string;
  sub: number | null; // null for Master
  name: string;       // e.g. "Silver 1"
  emoji: string;
  color: string;
}

interface TierDef { tier: string; emoji: string; color: string }

const TIERS: TierDef[] = [
  { tier: 'Bronze',   emoji: '🥉', color: '#cd7f32' },
  { tier: 'Silver',   emoji: '🥈', color: '#a8b8c8' },
  { tier: 'Gold',     emoji: '🥇', color: '#f0c040' },
  { tier: 'Platinum', emoji: '💎', color: '#7ec8e3' },
  { tier: 'Diamond',  emoji: '♦️',  color: '#b9f2ff' },
];

// 0–14: five tiers × three sub-ranks. 15: Master.
const RANK_TABLE: RankInfo[] = [
  ...TIERS.flatMap((t) =>
    ([1, 2, 3] as const).map((sub) => ({
      tier: t.tier, sub, name: `${t.tier} ${sub}`, emoji: t.emoji, color: t.color,
    }))
  ),
  { tier: 'Master', sub: null, name: 'Master', emoji: '👑', color: '#ff9f1c' },
];

export function getRank(index: number): RankInfo {
  return RANK_TABLE[Math.max(0, Math.min(MAX_RATING, Math.round(index)))];
}

// Ratings written before the switch to rank indices were Elo scores (~700–1600).
// Left as-is they read as "Master" and break matchmaking's rank-distance checks
// (|1054 − 946| is never inside any tolerance), so treat anything outside the
// rank-index range as legacy and fall back to the starting rank. Every read of a
// stored rating goes through here.
export function normalizeRating(rating: number | null | undefined): number {
  if (rating == null || !Number.isFinite(rating) || rating < 0 || rating > MAX_RATING) return DEFAULT_RATING;
  return Math.round(rating);
}

// Win → +1, Loss → −1, clamped to [0, MAX_RATING].
export function applyResult(rating: number, won: boolean): number {
  return Math.max(0, Math.min(MAX_RATING, rating + (won ? 1 : -1)));
}
