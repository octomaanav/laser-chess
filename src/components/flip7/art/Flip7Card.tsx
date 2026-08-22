// src/components/flip7/art/Flip7Card.tsx
import React from 'react';
import type { Card } from '@/game/flip7/types';
import { cn } from '@/lib/utils';

export interface Flip7CardProps {
  card: Card;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  isDuplicate?: boolean;
  isBust?: boolean;
  isNew?: boolean;
  isDimmed?: boolean;
  className?: string;
}

const NUMBER_CONFIG: Record<
  number,
  { word: string; fill: string; fillLight: string; accent: string; accentDark: string }
> = {
  0: { word: 'ZERO', fill: '#4b5563', fillLight: '#9ca3af', accent: '#6b7280', accentDark: '#374151' },
  1: { word: 'ONE', fill: '#dc2626', fillLight: '#f87171', accent: '#ef4444', accentDark: '#991b1b' },
  2: { word: 'TWO', fill: '#16a34a', fillLight: '#4ade80', accent: '#22c55e', accentDark: '#14532d' },
  3: { word: 'THREE', fill: '#2563eb', fillLight: '#60a5fa', accent: '#3b82f6', accentDark: '#1e3a8a' },
  4: { word: 'FOUR', fill: '#0d9488', fillLight: '#2dd4bf', accent: '#14b8a6', accentDark: '#115e59' },
  5: { word: 'FIVE', fill: '#9333ea', fillLight: '#c084fc', accent: '#a855f7', accentDark: '#581c87' },
  6: { word: 'SIX', fill: '#ea580c', fillLight: '#fb923c', accent: '#f97316', accentDark: '#9a3412' },
  7: { word: 'SEVEN', fill: '#ca8a04', fillLight: '#fde047', accent: '#eab308', accentDark: '#854d0e' },
  8: { word: 'EIGHT', fill: '#db2777', fillLight: '#f472b6', accent: '#ec4899', accentDark: '#831843' },
  9: { word: 'NINE', fill: '#f97316', fillLight: '#fdba74', accent: '#fb923c', accentDark: '#c2410c' },
  10: { word: 'TEN', fill: '#1d4ed8', fillLight: '#93c5fd', accent: '#2563eb', accentDark: '#1e3a8a' },
  11: { word: 'ELEVEN', fill: '#4f46e5', fillLight: '#a5b4fc', accent: '#6366f1', accentDark: '#312e81' },
  12: { word: 'TWELVE', fill: '#334155', fillLight: '#94a3b8', accent: '#64748b', accentDark: '#1e293b' },
};

export default function Flip7Card({
  card,
  size = 'md',
  isDuplicate = false,
  isBust = false,
  isNew = false,
  isDimmed = false,
  className,
}: Flip7CardProps) {
  const sizeMap = {
    xs: 'h-10 w-7',
    sm: 'h-14 w-10',
    md: 'h-20 w-14',
    lg: 'h-28 w-20',
    xl: 'h-36 w-24',
  };

  const bustEffect = isBust || isDuplicate;

  return (
    <div
      className={cn(
        sizeMap[size],
        'relative select-none overflow-hidden rounded-lg shadow-md transition-all duration-200',
        bustEffect && 'ring-2 ring-red-500 ring-offset-1 ring-offset-black scale-95 shadow-red-500/40',
        isNew && 'ring-2 ring-amber-400 ring-offset-1 ring-offset-black animate-pulse shadow-amber-400/50',
        isDimmed && 'opacity-40 grayscale',
        className
      )}
    >
      {bustEffect && (
        <div className="absolute -bottom-1 left-1/2 z-30 -translate-x-1/2 rounded-full bg-red-600 px-1.5 py-0.2 text-[8px] font-black uppercase tracking-wider text-white shadow-md border border-white">
          BUST!
        </div>
      )}

      {card.kind === 'number' && (
        <NumberCardSVG value={card.value} isBust={bustEffect} />
      )}

      {card.kind === 'modifier' && (
        <ModifierCardSVG value={card.value} />
      )}

      {card.kind === 'multiplier' && (
        <MultiplierCardSVG />
      )}

      {card.kind === 'action' && (
        <ActionCardSVG action={card.action} />
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// 1. NUMBER CARD SVG
// --------------------------------------------------------------------------
function NumberCardSVG({ value, isBust }: { value: number; isBust: boolean }) {
  const cfg = NUMBER_CONFIG[value] ?? NUMBER_CONFIG[0];
  const isDoubleDigit = value >= 10;
  const numFontSize = isDoubleDigit ? 42 : 52;
  const numY = isDoubleDigit ? 78 : 80;

  return (
    <svg viewBox="0 0 100 140" fill="none" xmlns="http://www.w3.org/2000/svg" className="size-full">
      <defs>
        <linearGradient id={`grad-num-${value}`} x1="0" y1="0" x2="0" y2="1" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={cfg.fillLight} />
          <stop offset="100%" stopColor={cfg.fill} />
        </linearGradient>
      </defs>

      {/* 1. Outer Card Base & Parchment Texture */}
      <rect width="100" height="140" rx="8" fill="#1b2430" />
      <rect x="2" y="2" width="96" height="136" rx="6.5" fill={isBust ? '#ffd9d9' : '#faf6ea'} />
      <rect x="4" y="4" width="92" height="132" rx="5" fill={isBust ? '#ffefef' : '#fffdf7'} />

      {/* 2. Inner Frame — simple elegant double line */}
      <rect x="7" y="7" width="86" height="126" rx="3.5" fill="none" stroke="#222a36" strokeWidth="1.2" />
      <rect x="9" y="9" width="82" height="122" rx="2.5" fill="none" stroke={cfg.accent} strokeWidth="0.6" strokeOpacity="0.5" />

      {/* 3. Corner Brackets */}
      <path d="M 7 15 L 15 15 L 15 7" stroke="#222a36" strokeWidth="1.2" fill="none" />
      <path d="M 93 15 L 85 15 L 85 7" stroke="#222a36" strokeWidth="1.2" fill="none" />
      <path d="M 7 125 L 15 125 L 15 133" stroke="#222a36" strokeWidth="1.2" fill="none" />
      <path d="M 93 125 L 85 125 L 85 133" stroke="#222a36" strokeWidth="1.2" fill="none" />

      {/* 4. Left & Right accent stripe bars */}
      <rect x="7" y="52" width="4" height="36" rx="2" fill={cfg.accent} opacity="0.7" />
      <rect x="89" y="52" width="4" height="36" rx="2" fill={cfg.accent} opacity="0.7" />



      {/* 6. Central Large Cartoon 3D Numeral */}
      <g transform="translate(50, 0)">
        {/* 3D Black Drop Shadow */}
        <text
          x="2"
          y={numY + 2}
          textAnchor="middle"
          fill="#1b2430"
          fontSize={numFontSize}
          fontWeight="900"
          fontFamily="Impact, Arial Black, sans-serif"
        >
          {value}
        </text>

        {/* Heavy Black Outline */}
        <text
          x="0"
          y={numY}
          textAnchor="middle"
          fill={`url(#grad-num-${value})`}
          fontSize={numFontSize}
          fontWeight="900"
          fontFamily="Impact, Arial Black, sans-serif"
          stroke="#1b2430"
          strokeWidth="4"
          strokeLinejoin="round"
        >
          {value}
        </text>

        {/* Crisp Color Fill */}
        <text
          x="0"
          y={numY}
          textAnchor="middle"
          fill={`url(#grad-num-${value})`}
          fontSize={numFontSize}
          fontWeight="900"
          fontFamily="Impact, Arial Black, sans-serif"
        >
          {value}
        </text>
      </g>

      {/* 7. Bottom Nameplate Ribbon */}
      <g transform="translate(50, 115)">
        {/* Ribbon banner background */}
        <rect
          x="-35"
          y="0"
          width="70"
          height="14"
          rx="3"
          fill="#faf6ea"
          stroke="#1b2430"
          strokeWidth="1.2"
        />
        <rect x="-33" y="2" width="66" height="10" rx="1.5" fill="none" stroke={cfg.accent} strokeWidth="0.75" />

        {/* Ribbon Fishtail Notch Caps */}
        <path d="M -35 0 L -38 7 L -35 14 Z" fill="#1b2430" />
        <path d="M 35 0 L 38 7 L 35 14 Z" fill="#1b2430" />

        {/* Spelled-Out Name */}
        <text
          x="0"
          y="10.5"
          textAnchor="middle"
          fill="#1b2430"
          fontSize="8"
          fontWeight="900"
          fontFamily="Impact, Arial Black, sans-serif"
          letterSpacing="1.8"
        >
          {cfg.word}
        </text>
      </g>
    </svg>
  );
}

// --------------------------------------------------------------------------
// 2. ACTION CARDS SVG (Second Chance, Flip Three, Freeze)
// --------------------------------------------------------------------------
function ActionCardSVG({ action }: { action: 'freeze' | 'flip-three' | 'second-chance' }) {
  if (action === 'second-chance') {
    return (
      <svg viewBox="0 0 100 140" fill="none" xmlns="http://www.w3.org/2000/svg" className="size-full">
        {/* Outer Red Card Base */}
        <rect width="100" height="140" rx="8" fill="#1b2430" />
        <rect x="2" y="2" width="96" height="136" rx="6.5" fill="#e74c3c" />
        <rect x="4.5" y="4.5" width="91" height="131" rx="5" fill="#d63031" />

        {/* Inner Cream Inset & Frame */}
        <rect x="7" y="7" width="86" height="126" rx="4" fill="none" stroke="#fff8e7" strokeWidth="1.5" />
        <rect x="9.5" y="9.5" width="81" height="121" rx="3" fill="none" stroke="#ffd875" strokeWidth="0.75" strokeDasharray="3 2" />

        {/* Corner Hearts */}
        <g transform="translate(14, 16)">
          <path d="M0 -3 C-3 -7 -8 -4 -8 0 C-8 5 0 9 0 9 C0 9 8 5 8 0 C8 -4 3 -7 0 -3 Z" fill="#ffd875" stroke="#1b2430" strokeWidth="0.75" />
        </g>
        <g transform="translate(86, 124) rotate(180)">
          <path d="M0 -3 C-3 -7 -8 -4 -8 0 C-8 5 0 9 0 9 C0 9 8 5 8 0 C8 -4 3 -7 0 -3 Z" fill="#ffd875" stroke="#1b2430" strokeWidth="0.75" />
        </g>

        {/* Center Shield Graphic */}
        <g transform="translate(50, 52)">
          <path d="M 0 -22 L 20 -14 L 20 6 C 20 18 0 26 0 26 C 0 26 -20 18 -20 6 L -20 -14 Z" fill="#fff8e7" stroke="#1b2430" strokeWidth="2.5" />
          <path d="M 0 -17 L 15 -11 L 15 5 C 15 14 0 20 0 20 C 0 20 -15 14 -15 5 L -15 -11 Z" fill="#ffd875" stroke="#1b2430" strokeWidth="1" />
          {/* Center Heart inside Shield */}
          <path d="M0 -2 C-3 -6 -8 -3 -8 1 C-8 6 0 10 0 10 C0 10 8 6 8 1 C8 -3 3 -6 0 -2 Z" fill="#e74c3c" stroke="#1b2430" strokeWidth="1" />
        </g>

        {/* "SECOND CHANCE" Comic Ribbon */}
        <g transform="translate(50, 92)">
          <rect x="-38" y="-12" width="76" height="15" rx="3" fill="#fff8e7" stroke="#1b2430" strokeWidth="1.75" transform="rotate(-3)" />
          <text x="0" y="-1" textAnchor="middle" fill="#1b2430" fontSize="11" fontWeight="900" fontFamily="Impact, Arial Black, sans-serif" letterSpacing="1" transform="rotate(-3)">SECOND</text>
          <rect x="-38" y="5" width="76" height="15" rx="3" fill="#ffd875" stroke="#1b2430" strokeWidth="1.75" transform="rotate(3)" />
          <text x="0" y="16.5" textAnchor="middle" fill="#1b2430" fontSize="11" fontWeight="900" fontFamily="Impact, Arial Black, sans-serif" letterSpacing="1" transform="rotate(3)">CHANCE</text>
        </g>

        {/* Subtext */}
        <text x="50" y="126" textAnchor="middle" fill="#fff8e7" fontSize="6.5" fontWeight="800" fontFamily="system-ui, sans-serif" letterSpacing="0.5">ABSORBS 1 DUPLICATE</text>
      </svg>
    );
  }

  if (action === 'flip-three') {
    return (
      <svg viewBox="0 0 100 140" fill="none" xmlns="http://www.w3.org/2000/svg" className="size-full">
        {/* Outer Yellow/Gold Card Base */}
        <rect width="100" height="140" rx="8" fill="#1b2430" />
        <rect x="2" y="2" width="96" height="136" rx="6.5" fill="#f1c40f" />
        <rect x="4.5" y="4.5" width="91" height="131" rx="5" fill="#e5a812" />

        {/* Inner Frame */}
        <rect x="7" y="7" width="86" height="126" rx="4" fill="none" stroke="#1b2430" strokeWidth="1.5" />
        <rect x="9.5" y="9.5" width="81" height="121" rx="3" fill="none" stroke="#c0392b" strokeWidth="0.75" strokeDasharray="3 2" />

        {/* 3 Flying Cards Graphic */}
        <g transform="translate(50, 42)">
          <rect x="-16" y="-12" width="16" height="24" rx="2.5" fill="#e74c3c" stroke="#1b2430" strokeWidth="1.5" transform="rotate(-25)" />
          <rect x="0" y="-12" width="16" height="24" rx="2.5" fill="#3498db" stroke="#1b2430" strokeWidth="1.5" transform="rotate(25)" />
          <rect x="-8" y="-14" width="16" height="24" rx="2.5" fill="#fff8e7" stroke="#1b2430" strokeWidth="1.8" />
          <text x="0" y="3" textAnchor="middle" fill="#e74c3c" fontSize="13" fontWeight="900" fontFamily="Impact, Arial Black, sans-serif">3</text>
        </g>

        {/* "FLIP THREE" Banners */}
        <g transform="translate(50, 84)">
          <rect x="-36" y="-12" width="72" height="15" rx="3" fill="#fff8e7" stroke="#1b2430" strokeWidth="1.75" />
          <text x="0" y="-1" textAnchor="middle" fill="#1b2430" fontSize="12" fontWeight="900" fontFamily="Impact, Arial Black, sans-serif" letterSpacing="1.2">FLIP</text>
          <rect x="-36" y="5" width="72" height="15" rx="3" fill="#e74c3c" stroke="#1b2430" strokeWidth="1.75" />
          <text x="0" y="16.5" textAnchor="middle" fill="#fff8e7" fontSize="12" fontWeight="900" fontFamily="Impact, Arial Black, sans-serif" letterSpacing="1.2">THREE</text>
        </g>

        {/* Subtext */}
        <text x="50" y="124" textAnchor="middle" fill="#1b2430" fontSize="6.5" fontWeight="800" fontFamily="system-ui, sans-serif" letterSpacing="0.5">PLAY ON AN ACTIVE PLAYER</text>
      </svg>
    );
  }

  // Freeze Action
  return (
    <svg viewBox="0 0 100 140" fill="none" xmlns="http://www.w3.org/2000/svg" className="size-full">
      {/* Outer Cyan/Ice Blue Card Base */}
      <rect width="100" height="140" rx="8" fill="#1b2430" />
      <rect x="2" y="2" width="96" height="136" rx="6.5" fill="#3498db" />
      <rect x="4.5" y="4.5" width="91" height="131" rx="5" fill="#2980b9" />

      {/* Inner Frame */}
      <rect x="7" y="7" width="86" height="126" rx="4" fill="none" stroke="#fff8e7" strokeWidth="1.5" />
      <rect x="9.5" y="9.5" width="81" height="121" rx="3" fill="none" stroke="#a0e2f5" strokeWidth="0.75" strokeDasharray="3 2" />

      {/* Padlock / Snowflake Graphic */}
      <g transform="translate(50, 44)">
        <path d="M -9 -4 L -9 -14 C -9 -21 9 -21 9 -14 L 9 -4" fill="none" stroke="#fff8e7" strokeWidth="3.5" strokeLinecap="round" />
        <rect x="-16" y="-6" width="32" height="26" rx="4" fill="#fff8e7" stroke="#1b2430" strokeWidth="2" />
        <circle cx="0" cy="7" r="3" fill="#2980b9" />
        <path d="M 0 0 L 0 14 M -7 7 L 7 7 M -5 2 L 5 12 M -5 12 L 5 2" stroke="#2980b9" strokeWidth="1.5" strokeLinecap="round" />
      </g>

      {/* "FREEZE" Comic Banner */}
      <g transform="translate(50, 88)">
        <rect x="-38" y="-10" width="76" height="18" rx="3.5" fill="#fff8e7" stroke="#1b2430" strokeWidth="2" />
        <text x="0" y="4" textAnchor="middle" fill="#1b2430" fontSize="14" fontWeight="900" fontFamily="Impact, Arial Black, sans-serif" letterSpacing="1.5">FREEZE</text>
      </g>

      {/* Subtext */}
      <text x="50" y="124" textAnchor="middle" fill="#fff8e7" fontSize="6.5" fontWeight="800" fontFamily="system-ui, sans-serif" letterSpacing="0.5">PLAY ON AN ACTIVE PLAYER</text>
    </svg>
  );
}

// --------------------------------------------------------------------------
// 3. MODIFIER CARD SVG (+2, +4, +6, +8, +10)
// --------------------------------------------------------------------------
function ModifierCardSVG({ value }: { value: number }) {
  return (
    <svg viewBox="0 0 100 140" fill="none" xmlns="http://www.w3.org/2000/svg" className="size-full">
      <defs>
        <linearGradient id="mod-grad" x1="0" y1="0" x2="0" y2="1" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2ecc71" />
          <stop offset="100%" stopColor="#1b8b4c" />
        </linearGradient>
      </defs>

      <rect width="100" height="140" rx="8" fill="#1b2430" />
      <rect x="2" y="2" width="96" height="136" rx="6.5" fill="#2ecc71" />
      <rect x="4.5" y="4.5" width="91" height="131" rx="5" fill="url(#mod-grad)" />

      <rect x="7" y="7" width="86" height="126" rx="4" fill="none" stroke="#fff8e7" strokeWidth="1.5" />
      <rect x="9.5" y="9.5" width="81" height="121" rx="3" fill="none" stroke="#ffd875" strokeWidth="0.75" strokeDasharray="3 2" />

      {/* Comic Burst Rays */}
      <g transform="translate(50, 58)" opacity="0.35">
        <polygon points="0,-35 8,-8 35,0 8,8 0,35 -8,8 -35,0 -8,-8" fill="#fff8e7" />
        <polygon points="0,-35 8,-8 35,0 8,8 0,35 -8,8 -35,0 -8,-8" fill="#ffd875" transform="rotate(45)" />
      </g>

      {/* Corner Badges */}
      <text x="13" y="21" fill="#fff8e7" fontSize="11" fontWeight="900" fontFamily="Impact, Arial Black, sans-serif" textAnchor="middle">+{value}</text>
      <text x="87" y="125" fill="#fff8e7" fontSize="11" fontWeight="900" fontFamily="Impact, Arial Black, sans-serif" textAnchor="middle" transform="rotate(180 87 121)">+{value}</text>

      {/* Central Big Number */}
      <g transform="translate(50, 68)">
        <text x="2" y="2" textAnchor="middle" fill="#1b2430" fontSize="42" fontWeight="900" fontFamily="Impact, Arial Black, sans-serif">+{value}</text>
        <text x="0" y="0" textAnchor="middle" fill="#fff8e7" fontSize="42" fontWeight="900" fontFamily="Impact, Arial Black, sans-serif" stroke="#1b2430" strokeWidth="3.5">+{value}</text>
        <text x="0" y="0" textAnchor="middle" fill="#fff8e7" fontSize="42" fontWeight="900" fontFamily="Impact, Arial Black, sans-serif">+{value}</text>
      </g>

      {/* Bottom Ribbon */}
      <g transform="translate(50, 114)">
        <rect x="-35" y="0" width="70" height="14" rx="3" fill="#fff8e7" stroke="#1b2430" strokeWidth="1.2" />
        <text x="0" y="10.5" textAnchor="middle" fill="#1b2430" fontSize="8" fontWeight="900" fontFamily="Impact, Arial Black, sans-serif" letterSpacing="1.2">BONUS POINTS</text>
      </g>
    </svg>
  );
}

// --------------------------------------------------------------------------
// 4. MULTIPLIER CARD SVG (×2)
// --------------------------------------------------------------------------
function MultiplierCardSVG() {
  return (
    <svg viewBox="0 0 100 140" fill="none" xmlns="http://www.w3.org/2000/svg" className="size-full">
      <defs>
        <linearGradient id="mult-grad" x1="0" y1="0" x2="0" y2="1" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f39c12" />
          <stop offset="100%" stopColor="#d35400" />
        </linearGradient>
      </defs>

      <rect width="100" height="140" rx="8" fill="#1b2430" />
      <rect x="2" y="2" width="96" height="136" rx="6.5" fill="#f1c40f" />
      <rect x="4.5" y="4.5" width="91" height="131" rx="5" fill="url(#mult-grad)" />

      <rect x="7" y="7" width="86" height="126" rx="4" fill="none" stroke="#fff8e7" strokeWidth="1.5" />
      <rect x="9.5" y="9.5" width="81" height="121" rx="3" fill="none" stroke="#ffd875" strokeWidth="0.75" strokeDasharray="3 2" />

      {/* Center Sparkles & Sunburst */}
      <g transform="translate(50, 58)" opacity="0.4">
        <polygon points="0,-36 9,-9 36,0 9,9 0,36 -9,9 -36,0 -9,-9" fill="#fff8e7" />
        <polygon points="0,-36 9,-9 36,0 9,9 0,36 -9,9 -36,0 -9,-9" fill="#ffd875" transform="rotate(45)" />
      </g>

      {/* Corner Badges */}
      <text x="13" y="21" fill="#fff8e7" fontSize="12" fontWeight="900" fontFamily="Impact, Arial Black, sans-serif" textAnchor="middle">×2</text>
      <text x="87" y="125" fill="#fff8e7" fontSize="12" fontWeight="900" fontFamily="Impact, Arial Black, sans-serif" textAnchor="middle" transform="rotate(180 87 121)">×2</text>

      {/* Central Big ×2 */}
      <g transform="translate(50, 68)">
        <text x="2" y="2" textAnchor="middle" fill="#1b2430" fontSize="46" fontWeight="900" fontFamily="Impact, Arial Black, sans-serif">×2</text>
        <text x="0" y="0" textAnchor="middle" fill="#ffd875" fontSize="46" fontWeight="900" fontFamily="Impact, Arial Black, sans-serif" stroke="#1b2430" strokeWidth="3.5">×2</text>
        <text x="0" y="0" textAnchor="middle" fill="#ffd875" fontSize="46" fontWeight="900" fontFamily="Impact, Arial Black, sans-serif">×2</text>
      </g>

      {/* Bottom Ribbon */}
      <g transform="translate(50, 114)">
        <rect x="-35" y="0" width="70" height="14" rx="3" fill="#fff8e7" stroke="#1b2430" strokeWidth="1.2" />
        <text x="0" y="10.5" textAnchor="middle" fill="#1b2430" fontSize="8" fontWeight="900" fontFamily="Impact, Arial Black, sans-serif" letterSpacing="1.2">DOUBLE SCORE</text>
      </g>
    </svg>
  );
}
