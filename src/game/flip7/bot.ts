// src/game/flip7/bot.ts
// Pure AI decision engine for Flip 7 bots across Easy, Medium, and Hard difficulties.
import type { ActionKind, Card, Flip7State, NumberValue } from './types';
import { computeHandScore } from './engine';

export type BotDifficulty = 'easy' | 'medium' | 'hard';

// Full standard deck count breakdown for card counting
const DECK_NUMBER_COUNTS: Record<NumberValue, number> = {
  0: 1,
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
  9: 9,
  10: 10,
  11: 11,
  12: 12,
};
const TOTAL_MODIFIERS = 5; // +2, +4, +6, +8, +10
const TOTAL_MULTIPLIERS = 1; // x2
const TOTAL_ACTIONS = 9; // 3 freeze, 3 flip-three, 3 second-chance
const TOTAL_DECK_SIZE = 94;

/**
 * Calculates the exact or estimated bust probability of drawing another card
 * given the known visible cards in hands, discard, and current held numbers.
 */
export function calculateBustProbability(state: Flip7State, botId: string): number {
  const bot = state.players.find((p) => p.id === botId);
  if (!bot) return 0;

  // If bot holds a Second Chance card, drawing a duplicate will NOT bust it!
  const hasSecondChance = bot.hand.some((c) => c.kind === 'action' && c.action === 'second-chance');
  if (hasSecondChance) {
    return 0; // Protected from bust
  }

  // Count known copies of each number card currently visible on the table
  const visibleCounts: Record<number, number> = {};
  for (let i = 0; i <= 12; i++) visibleCounts[i] = 0;

  const countCard = (c: Card) => {
    if (c.kind === 'number') {
      visibleCounts[c.value] = (visibleCounts[c.value] || 0) + 1;
    }
  };

  // Discard pile
  for (const c of state.discard) countCard(c);
  // All players' current hands
  for (const p of state.players) {
    for (const c of p.hand) countCard(c);
  }

  const botNumbers = new Set(
    bot.hand.filter((c) => c.kind === 'number').map((c) => (c as { value: number }).value)
  );

  if (botNumbers.size === 0) {
    return 0; // First number card can never duplicate
  }

  // Total visible cards
  let totalVisible = state.discard.length;
  for (const p of state.players) totalVisible += p.hand.length;

  const estimatedRemainingDeck = Math.max(1, TOTAL_DECK_SIZE - totalVisible);

  // Sum unrevealed copies of numbers the bot already holds
  let dangerousCopiesRemaining = 0;
  for (const num of botNumbers) {
    const totalInDeck = DECK_NUMBER_COUNTS[num as NumberValue] ?? 0;
    const seen = visibleCounts[num] ?? 0;
    const remaining = Math.max(0, totalInDeck - seen);
    dangerousCopiesRemaining += remaining;
  }

  return Math.min(1, dangerousCopiesRemaining / estimatedRemainingDeck);
}

/**
 * Decides whether the bot should 'hit' (draw) or 'stay' (bank).
 */
export function decideBotMove(
  state: Flip7State,
  botId: string,
  difficulty: BotDifficulty
): 'hit' | 'stay' {
  const bot = state.players.find((p) => p.id === botId);
  if (!bot || bot.status !== 'active') return 'stay';

  const handScore = computeHandScore(bot.hand);
  const numberCards = bot.hand.filter((c) => c.kind === 'number');
  const uniqueNumbers = numberCards.length;
  const hasSecondChance = bot.hand.some((c) => c.kind === 'action' && c.action === 'second-chance');
  const bustProb = calculateBustProbability(state, botId);

  // Check how close leader is to 200
  const maxTotalScore = Math.max(...state.players.map((p) => p.totalScore));
  const botTotalScore = bot.totalScore;
  const botTrailingBy = maxTotalScore - botTotalScore;

  // 1. EASY DIFFICULTY: Simplistic heuristic with occasional random behavior
  if (difficulty === 'easy') {
    // If holding Second Chance, always draw
    if (hasSecondChance) return 'hit';

    // 15% random blunder chance
    if (Math.random() < 0.15) {
      return Math.random() < 0.5 ? 'hit' : 'stay';
    }

    // Always draw if 0 or 1 number card or low score
    if (uniqueNumbers <= 2 || handScore < 14) return 'hit';

    // Stay once score reaches 18+ or has 4+ cards
    if (handScore >= 20 || uniqueNumbers >= 4) return 'stay';

    return bustProb > 0.3 ? 'stay' : 'hit';
  }

  // 2. MEDIUM DIFFICULTY: Solid risk-management strategy
  if (difficulty === 'medium') {
    // Always draw with Second Chance
    if (hasSecondChance) return 'hit';

    // 0 or 1 card is zero risk
    if (uniqueNumbers <= 1) return 'hit';

    // Chase Flip 7 if at 6/7 unique numbers and bust probability is moderate
    if (uniqueNumbers === 6 && bustProb < 0.45) return 'hit';

    // If score + banked reaches winning 200, stay and secure it!
    if (botTotalScore + handScore >= 200) return 'stay';

    // If trailing significantly behind leader, take higher calculated risk
    const riskTolerance = botTrailingBy > 40 ? 0.38 : 0.28;

    if (bustProb > riskTolerance) return 'stay';
    if (handScore >= 24 && bustProb > 0.22) return 'stay';

    return 'hit';
  }

  // 3. HARD DIFFICULTY: Advanced Card-Counting & Expected Value (EV)
  // Compute Expected Value of drawing another card:
  // EV(draw) = (1 - P(bust)) * (Expected Gain) - P(bust) * (Current Hand Score)
  if (hasSecondChance) {
    // Second chance absorbs 1 bust, almost always +EV to draw unless hand is already game-winning
    if (botTotalScore + handScore >= 200) return 'stay';
    return 'hit';
  }

  if (uniqueNumbers <= 1) return 'hit';

  // If current hand + banked hits 200, lock in the win!
  if (botTotalScore + handScore >= 200) return 'stay';

  // High bonus upside for Flip 7
  let bonusUpside = 0;
  if (uniqueNumbers === 5) bonusUpside = 3;
  else if (uniqueNumbers === 6) bonusUpside = 10;

  // Average card value expected ~6.5 pts
  const expectedGain = 6.5 + bonusUpside;
  const ev = (1 - bustProb) * expectedGain - bustProb * handScore;

  // If trailing the leader near 200, take more aggressive lines
  if (maxTotalScore >= 160 && botTrailingBy > 30) {
    return ev > -3 ? 'hit' : 'stay';
  }

  return ev > 0 ? 'hit' : 'stay';
}

/**
 * Decides target player for action cards (Freeze, Flip Three, Second Chance giveaway).
 */
export function decideBotTarget(
  state: Flip7State,
  botId: string,
  kind: ActionKind,
  difficulty: BotDifficulty
): string {
  const activeOpponents = state.players.filter((p) => p.id !== botId && p.status === 'active');
  if (activeOpponents.length === 0) return botId; // Fallback

  // 1. EASY: Random selection
  if (difficulty === 'easy') {
    if (kind === 'second-chance') {
      const eligible = activeOpponents.filter(
        (p) => !p.hand.some((c) => c.kind === 'action' && c.action === 'second-chance')
      );
      if (eligible.length > 0) {
        return eligible[Math.floor(Math.random() * eligible.length)].id;
      }
    }
    return activeOpponents[Math.floor(Math.random() * activeOpponents.length)].id;
  }

  // 2. FREEZE: Target the player with highest current hand score or highest total threat
  if (kind === 'freeze') {
    // Sort by current hand score descending, breaking ties by total score
    const sorted = [...activeOpponents].sort((a, b) => {
      const scoreA = computeHandScore(a.hand) + a.totalScore * 0.1;
      const scoreB = computeHandScore(b.hand) + b.totalScore * 0.1;
      return scoreB - scoreA;
    });
    return sorted[0].id;
  }

  // 3. FLIP THREE: Target the player with the most cards (highest bust probability on 3 forced draws)
  if (kind === 'flip-three') {
    const sorted = [...activeOpponents].sort((a, b) => {
      const cardsA = a.hand.filter((c) => c.kind === 'number').length;
      const cardsB = b.hand.filter((c) => c.kind === 'number').length;
      if (cardsB !== cardsA) return cardsB - cardsA;
      return b.totalScore - a.totalScore;
    });
    return sorted[0].id;
  }

  // 4. SECOND CHANCE GIVEAWAY: Give to the lowest-scoring / least threatening opponent
  if (kind === 'second-chance') {
    const eligible = activeOpponents.filter(
      (p) => !p.hand.some((c) => c.kind === 'action' && c.action === 'second-chance')
    );
    if (eligible.length === 0) return activeOpponents[0].id;

    const sorted = [...eligible].sort((a, b) => a.totalScore - b.totalScore);
    return sorted[0].id;
  }

  return activeOpponents[0].id;
}

// Realistic human-like names for bots
export const BOT_NAMES = [
  'Alex Rivers',
  'Elena Rostova',
  'Marcus Vance',
  'Samira Khan',
  'Oliver Pratt',
  'Sophia Miller',
  'Leo Zhang',
  'Maya Chen',
  'Lucas Sterling',
  'Chloe Bennett',
  'Daniel Torres',
  'Aria Thorne',
  'Kai Takahashi',
  'Zoe Patel',
  'Ethan Brooks',
];
