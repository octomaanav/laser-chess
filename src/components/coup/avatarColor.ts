// src/components/coup/avatarColor.ts
// Deterministic color per player id so every seat has a stable visual
// identity beyond just a name - the same player keeps the same color for
// the whole game (and across reconnects, since it's derived from their id).
const PALETTE = ['#e0b354', '#5db8e8', '#d088c8', '#6aad7c', '#ff6b57', '#9aa0a8', '#e8a848', '#7c9fe8'];

export function avatarColorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export function initialsFor(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
