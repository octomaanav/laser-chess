import React from 'react';

interface GameCardIconProps {
  slug: string;
  accent: string;
  className?: string;
  size?: number;
}

export default function GameCardIcon({ slug, accent, className, size = 28 }: GameCardIconProps) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 32 32',
    fill: 'none',
    className: className || 'shrink-0',
  };

  switch (slug) {
    case 'laser-chess':
      return (
        <svg {...common}>
          <defs>
            <linearGradient id="lc-mirror" x1="6" y1="26" x2="26" y2="6" gradientUnits="userSpaceOnUse">
              <stop stopColor={accent} stopOpacity="0.9" />
              <stop offset="1" stopColor="#ffffff" stopOpacity="0.4" />
            </linearGradient>
            <filter id="lc-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          {/* Mirror deflector piece */}
          <path
            d="M7 25L25 25L7 7Z"
            fill="url(#lc-mirror)"
            stroke={accent}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          {/* Laser beam entering from top and deflecting right */}
          <path
            d="M16 3L16 16L29 16"
            stroke="#ff3366"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#lc-glow)"
          />
          {/* Reflection point pulse */}
          <circle cx="16" cy="16" r="2.5" fill="#ffffff" filter="url(#lc-glow)" />
        </svg>
      );

    case 'coup':
      return (
        <svg {...common}>
          <defs>
            <linearGradient id="coup-gold" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
              <stop stopColor="#ffd700" />
              <stop offset="1" stopColor={accent} />
            </linearGradient>
          </defs>
          {/* Crown base and peaks */}
          <path
            d="M5 23L7 11L12 17L16 8L20 17L25 11L27 23H5Z"
            fill="url(#coup-gold)"
            fillOpacity="0.25"
            stroke="url(#coup-gold)"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          {/* Crown jewels */}
          <circle cx="16" cy="7" r="1.5" fill="#ffffff" />
          <circle cx="7" cy="10" r="1.2" fill={accent} />
          <circle cx="25" cy="10" r="1.2" fill={accent} />
          {/* Mask / Dagger flourish at base */}
          <path
            d="M9 25C13 27 19 27 23 25"
            stroke="url(#coup-gold)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'secret-hitler':
      return (
        <svg {...common}>
          <defs>
            <linearGradient id="sh-grad" x1="6" y1="6" x2="26" y2="26" gradientUnits="userSpaceOnUse">
              <stop stopColor={accent} />
              <stop offset="1" stopColor="#ff4444" />
            </linearGradient>
          </defs>
          {/* Classified Dossier Outline */}
          <rect
            x="6"
            y="5"
            width="20"
            height="22"
            rx="3"
            fill={accent}
            fillOpacity="0.15"
            stroke={accent}
            strokeWidth="1.8"
          />
          {/* Secret Eye / Investigator symbol */}
          <path
            d="M10 16C12.5 12 19.5 12 22 16C19.5 20 12.5 20 10 16Z"
            stroke="#ffffff"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <circle cx="16" cy="16" r="2.2" fill={accent} />
          <line x1="10" y1="9" x2="18" y2="9" stroke={accent} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );

    case 'ranked-poker':
      return (
        <svg {...common}>
          <defs>
            <linearGradient id="poker-grad" x1="8" y1="4" x2="24" y2="28" gradientUnits="userSpaceOnUse">
              <stop stopColor="#ffffff" />
              <stop offset="1" stopColor={accent} />
            </linearGradient>
          </defs>
          {/* Modern stylized Spade Ace */}
          <path
            d="M16 6C13 11 8 15 8 19C8 22 11 24 14 23C15 22.5 15.5 21.5 16 20.5C16.5 21.5 17 22.5 18 23C21 24 24 22 24 19C24 15 19 11 16 6Z"
            fill={accent}
            fillOpacity="0.25"
            stroke="url(#poker-grad)"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          {/* Stem of spade */}
          <path
            d="M16 20V26M13 26H19"
            stroke="url(#poker-grad)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );

    case 'werewolf':
      return (
        <svg {...common}>
          <defs>
            <linearGradient id="ww-grad" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
              <stop stopColor="#e2d4ff" />
              <stop offset="1" stopColor={accent} />
            </linearGradient>
          </defs>
          {/* Crescent Moon */}
          <path
            d="M21 5C14.5 6 10 11.5 10 18C10 23 13 26.5 17 28C11 27.5 6 22.5 6 16C6 9 11 4.5 18 4C19 4 20 4.5 21 5Z"
            fill={accent}
            fillOpacity="0.25"
            stroke="url(#ww-grad)"
            strokeWidth="1.6"
          />
          {/* Stylized Wolf silhouette */}
          <path
            d="M14 26L18 20L19 14L23 12L21 16L26 15L23 20L21 26H14Z"
            fill={accent}
            stroke="#ffffff"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'codenames':
      return (
        <svg {...common}>
          <defs>
            <linearGradient id="cn-grad" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
              <stop stopColor="#fff275" />
              <stop offset="1" stopColor={accent} />
            </linearGradient>
          </defs>
          {/* 3x3 Key Grid */}
          <rect x="5" y="5" width="22" height="22" rx="3.5" stroke={accent} strokeWidth="1.6" fill={accent} fillOpacity="0.1" />
          <rect x="8" y="8" width="4" height="4" rx="1" fill="#ffffff" />
          <rect x="14" y="8" width="4" height="4" rx="1" fill={accent} />
          <rect x="20" y="8" width="4" height="4" rx="1" fill="#ffffff" />
          <rect x="8" y="14" width="4" height="4" rx="1" fill={accent} />
          <rect x="14" y="14" width="4" height="4" rx="1" fill="#ff4444" />
          <rect x="20" y="14" width="4" height="4" rx="1" fill={accent} />
          <rect x="8" y="20" width="4" height="4" rx="1" fill="#ffffff" />
          <rect x="14" y="20" width="4" height="4" rx="1" fill="#ffffff" />
          <rect x="20" y="20" width="4" height="4" rx="1" fill={accent} />
        </svg>
      );

    default:
      return (
        <svg {...common}>
          <circle cx="16" cy="16" r="11" stroke={accent} strokeWidth="2" fill={accent} fillOpacity="0.2" />
        </svg>
      );
  }
}
