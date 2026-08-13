// src/components/coup/PlayerAvatar.tsx
import { avatarColorFor, initialsFor } from './avatarColor';

export default function PlayerAvatar({
  id,
  name,
  size = 28,
  muted = false,
}: {
  id: string;
  name: string;
  size?: number;
  muted?: boolean;
}) {
  const color = avatarColorFor(id);
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full border font-bold uppercase"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        color: muted ? 'var(--coup-text-muted)' : color,
        borderColor: muted ? 'var(--coup-panel-border)' : `${color}88`,
        background: muted ? 'var(--coup-table-bg)' : `color-mix(in oklab, ${color} 18%, transparent)`,
      }}
      aria-hidden
    >
      {initialsFor(name)}
    </span>
  );
}
