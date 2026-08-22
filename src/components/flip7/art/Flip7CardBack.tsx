// src/components/flip7/art/Flip7CardBack.tsx
import React from 'react';
import { cn } from '@/lib/utils';

export default function Flip7CardBack({
  className,
  size = 'md',
}: {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}) {
  const sizeMap = {
    xs: 'h-10 w-7',
    sm: 'h-14 w-10',
    md: 'h-20 w-14',
    lg: 'h-28 w-20',
    xl: 'h-36 w-24',
  };

  return (
    <div
      className={cn(
        sizeMap[size],
        'relative select-none overflow-hidden rounded-lg shadow-md transition-transform',
        className
      )}
    >
      <svg
        viewBox="0 0 100 140"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="size-full"
      >
        <defs>
          {/* Teal comic background gradient */}
          <linearGradient id="f7-back-teal" x1="0" y1="0" x2="100" y2="140" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1e94a8" />
            <stop offset="50%" stopColor="#157a8a" />
            <stop offset="100%" stopColor="#0d5763" />
          </linearGradient>

          {/* Halftone / retro dot pattern */}
          <pattern id="f7-back-dots" width="6" height="6" patternUnits="userSpaceOnUse">
            <circle cx="3" cy="3" r="0.75" fill="#ffffff" fillOpacity="0.12" />
          </pattern>

          <linearGradient id="f7-gold-7" x1="0" y1="0" x2="0" y2="1" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#fff385" />
            <stop offset="50%" stopColor="#ffb81c" />
            <stop offset="100%" stopColor="#e07e00" />
          </linearGradient>

          <filter id="f7-shadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="1" dy="2" stdDeviation="1" floodColor="#000000" floodOpacity="0.6" />
          </filter>
        </defs>

        {/* Outer card border */}
        <rect width="100" height="140" rx="8" fill="#1b2430" />
        <rect x="2" y="2" width="96" height="136" rx="6.5" fill="#fff8e7" />
        
        {/* Main teal card body */}
        <rect x="4.5" y="4.5" width="91" height="131" rx="5" fill="url(#f7-back-teal)" />
        <rect x="4.5" y="4.5" width="91" height="131" rx="5" fill="url(#f7-back-dots)" />

        {/* Vintage comic inner frame lines */}
        <rect x="7" y="7" width="86" height="126" rx="4" fill="none" stroke="#fff8e7" strokeWidth="1.2" strokeOpacity="0.8" />
        <rect x="9.5" y="9.5" width="81" height="121" rx="3" fill="none" stroke="#ffd875" strokeWidth="0.75" strokeOpacity="0.6" strokeDasharray="3 2" />

        {/* Decorative corner stars — snug in each corner */}
        <g transform="translate(10, 10) scale(0.7)">
          <polygon points="0,-5 1.5,-1.5 5,0 1.5,1.5 0,5 -1.5,1.5 -5,0 -1.5,-1.5" fill="#ffd875" opacity="0.9" />
        </g>
        <g transform="translate(90, 10) scale(0.7)">
          <polygon points="0,-5 1.5,-1.5 5,0 1.5,1.5 0,5 -1.5,1.5 -5,0 -1.5,-1.5" fill="#ffd875" opacity="0.9" />
        </g>
        <g transform="translate(10, 130) scale(0.7)">
          <polygon points="0,-5 1.5,-1.5 5,0 1.5,1.5 0,5 -1.5,1.5 -5,0 -1.5,-1.5" fill="#ffd875" opacity="0.9" />
        </g>
        <g transform="translate(90, 130) scale(0.7)">
          <polygon points="0,-5 1.5,-1.5 5,0 1.5,1.5 0,5 -1.5,1.5 -5,0 -1.5,-1.5" fill="#ffd875" opacity="0.9" />
        </g>

        {/* Center Comic Badge & "FLIP 7" Logo */}
        <g transform="translate(50, 70)">
          {/* Badge Background */}
          <ellipse cx="0" cy="0" rx="35" ry="42" fill="#fff8e7" stroke="#1b2430" strokeWidth="2.5" />
          <ellipse cx="0" cy="0" rx="32" ry="39" fill="none" stroke="#e5a812" strokeWidth="1" />

          {/* Mini colorful cards fanning above the logo */}
          <g transform="translate(0, -22) scale(0.65)">
            {/* Card 1: Pink */}
            <rect x="-18" y="-12" width="10" height="15" rx="1.5" fill="#e91e63" stroke="#1b2430" strokeWidth="1" transform="rotate(-25)" />
            {/* Card 2: Orange */}
            <rect x="-10" y="-14" width="10" height="15" rx="1.5" fill="#ff9800" stroke="#1b2430" strokeWidth="1" transform="rotate(-12)" />
            {/* Card 3: Yellow */}
            <rect x="-5" y="-15" width="10" height="15" rx="1.5" fill="#ffeb3b" stroke="#1b2430" strokeWidth="1" />
            {/* Card 4: Green */}
            <rect x="0" y="-14" width="10" height="15" rx="1.5" fill="#4caf50" stroke="#1b2430" strokeWidth="1" transform="rotate(12)" />
            {/* Card 5: Cyan */}
            <rect x="8" y="-12" width="10" height="15" rx="1.5" fill="#00bcd4" stroke="#1b2430" strokeWidth="1" transform="rotate(25)" />
          </g>

          {/* "FLIP" Comic Text */}
          <g transform="translate(0, -6)" filter="url(#f7-shadow)">
            <text
              x="0"
              y="0"
              textAnchor="middle"
              fill="#1b2430"
              fontSize="14"
              fontWeight="900"
              fontFamily="Impact, Arial Black, sans-serif"
              letterSpacing="1"
            >
              FLIP
            </text>
            <text
              x="0"
              y="-1"
              textAnchor="middle"
              fill="#fff"
              fontSize="14"
              fontWeight="900"
              fontFamily="Impact, Arial Black, sans-serif"
              letterSpacing="1"
              stroke="#1b2430"
              strokeWidth="0.75"
            >
              FLIP
            </text>
          </g>

          {/* Giant "7" Comic Numeral */}
          <g transform="translate(0, 25)" filter="url(#f7-shadow)">
            {/* 3D Black shadow */}
            <text
              x="2"
              y="2"
              textAnchor="middle"
              fill="#1b2430"
              fontSize="34"
              fontWeight="900"
              fontFamily="Impact, Arial Black, sans-serif"
            >
              7
            </text>
            {/* Outline */}
            <text
              x="0"
              y="0"
              textAnchor="middle"
              fill="url(#f7-gold-7)"
              fontSize="34"
              fontWeight="900"
              fontFamily="Impact, Arial Black, sans-serif"
              stroke="#1b2430"
              strokeWidth="3.5"
            >
              7
            </text>
            {/* Top Gloss Highlight */}
            <text
              x="0"
              y="0"
              textAnchor="middle"
              fill="url(#f7-gold-7)"
              fontSize="34"
              fontWeight="900"
              fontFamily="Impact, Arial Black, sans-serif"
            >
              7
            </text>
          </g>
        </g>
      </svg>
    </div>
  );
}
