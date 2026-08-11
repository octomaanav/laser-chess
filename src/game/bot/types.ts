// Difficulty is a dial on the same search/eval engine (time budget + eval
// noise) — not three different bots. See docs/superpowers/specs/2026-08-11-bot-opponent-design.md.
export type Difficulty = 'easy' | 'medium' | 'hard';
export const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];
