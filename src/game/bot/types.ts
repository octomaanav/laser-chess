// Difficulty is a dial on the same search/eval engine (time budget, eval
// noise, depth, search extensions) - not separate bots. See bot.ts for the
// tiers and docs/superpowers/specs/2026-08-11-bot-opponent-design.md.
export type Difficulty = 'easy' | 'medium' | 'hard' | 'extreme';
export const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard', 'extreme'];
