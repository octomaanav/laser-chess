// Coup's mark: a gold dagger crossing a crimson mask outline on a dark badge —
// echoes the bluff/betrayal theme, self-contained colors so it reads on both themes.
export default function CoupLogoMark({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex" aria-hidden>
      <svg width={size} height={size} viewBox="0 0 32 32">
        <rect width="32" height="32" rx="7" fill="#1c1420" />
        <path
          d="M10 8c0 6-3 8-3 12 0 4.5 3.8 8 9 8s9-3.5 9-8c0-4-3-6-3-12-1.8 2-4 3-6 3s-4.2-1-6-3Z"
          fill="none"
          stroke="#c8155e"
          strokeWidth="1.6"
        />
        <circle cx="12.5" cy="17" r="1.3" fill="#c8155e" />
        <circle cx="19.5" cy="17" r="1.3" fill="#c8155e" />
        <g strokeLinecap="round">
          <line x1="9" y1="23" x2="23" y2="9" stroke="#e0b354" strokeWidth="2.4" />
          <line x1="9" y1="23" x2="12" y2="23" stroke="#e0b354" strokeWidth="2.4" />
          <line x1="20" y1="12" x2="23" y2="9" stroke="#e0b354" strokeWidth="2.4" />
        </g>
      </svg>
    </span>
  );
}
