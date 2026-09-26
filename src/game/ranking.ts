// 16 rank levels stored as an integer index: 0 = Bronze 1, 14 = Diamond 3, 15 = Master.
// Within a rank you collect stars; a full set promotes you. Each tier asks for
// more stars than the last, and losses cost more near the top, so Master takes
// a long run of wins against the strongest bots and players - and has to be
// defended: a loss at Master drops you straight back into Diamond.

export const DEFAULT_RATING = 3; // Silver 1
export const MAX_RATING = 15;    // Master

export interface RankInfo {
  tier: string;
  sub: number | null; // null for Master
  name: string;       // e.g. "Silver 1"
  emoji: string;
  color: string;
}

interface TierDef {
  tier: string;
  emoji: string;
  color: string;
  stars: number;    // stars to climb out of each of this tier's sub-ranks
  lossCost: number; // stars a loss takes away
}

const TIERS: TierDef[] = [
  { tier: 'Bronze',   emoji: '🥉', color: '#cd7f32', stars: 1, lossCost: 1 },
  { tier: 'Silver',   emoji: '🥈', color: '#a8b8c8', stars: 2, lossCost: 1 },
  { tier: 'Gold',     emoji: '🥇', color: '#f0c040', stars: 3, lossCost: 1 },
  { tier: 'Platinum', emoji: '💎', color: '#7ec8e3', stars: 4, lossCost: 1 },
  { tier: 'Diamond',  emoji: '♦️',  color: '#b9f2ff', stars: 5, lossCost: 2 },
];
const MASTER_LOSS_COST = 2;

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

const tierOf = (rating: number): TierDef | null => TIERS[Math.floor(rating / 3)] ?? null;

// Stars needed to promote out of `rating`; 0 at Master (nothing above it).
export function starsToPromote(rating: number): number {
  return tierOf(rating)?.stars ?? 0;
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

// Stars are only meaningful below Master and below that rank's promotion bar.
export function normalizeStars(rating: number, stars: number | null | undefined): number {
  if (stars == null || !Number.isFinite(stars) || stars < 0) return 0;
  return Math.min(Math.round(stars), Math.max(0, starsToPromote(rating) - 1));
}

export interface RankProgress {
  rating: number;
  stars: number;
}

// Win → +1 star, promoting when the rank's stars are full.
// Loss → lose the tier's loss cost in stars; running out drops a sub-rank
// (landing with that rank's stars minus the remainder). Bronze 1 is the floor.
export function applyResult(progress: RankProgress, won: boolean): RankProgress {
  let { rating, stars } = progress;
  if (won) {
    if (rating >= MAX_RATING) return { rating: MAX_RATING, stars: 0 };
    stars += 1;
    if (stars >= starsToPromote(rating)) return { rating: rating + 1, stars: 0 };
    return { rating, stars };
  }

  stars -= rating >= MAX_RATING ? MASTER_LOSS_COST : tierOf(rating)!.lossCost;
  while (stars < 0) {
    if (rating === 0) return { rating: 0, stars: 0 };
    rating -= 1;
    stars += starsToPromote(rating);
  }
  return { rating, stars };
}
