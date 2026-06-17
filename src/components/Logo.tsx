import React, { useId } from 'react';

interface LogoProps {
  className?: string;
  size?: number;
}

export function Logo({ className = '', size = 36 }: LogoProps) {
  const uniqueId = useId();
  const safeId = uniqueId.replace(/:/g, '_');
  
  const bgGradId = `bgGrad-${safeId}`;
  const deepWaveId = `deepWave-${safeId}`;
  const midWaveId = `midWave-${safeId}`;
  const frontWaveId = `frontWave-${safeId}`;
  const accentSignalId = `accentSignal-${safeId}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${className}`}
    >
      <defs>
        {/* Gradients matching the design */}
        <linearGradient id={bgGradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#081e26" />
          <stop offset="100%" stopColor="#0a252e" />
        </linearGradient>

        <linearGradient id={deepWaveId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#004e64" />
          <stop offset="50%" stopColor="#006080" />
          <stop offset="100%" stopColor="#004e64" />
        </linearGradient>

        <linearGradient id={midWaveId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#00aa9f" />
          <stop offset="50%" stopColor="#00c4b6" />
          <stop offset="100%" stopColor="#00aa9f" />
        </linearGradient>

        <linearGradient id={frontWaveId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#00f5d4" />
          <stop offset="50%" stopColor="#2ec4b6" />
          <stop offset="100%" stopColor="#00f5d4" />
        </linearGradient>

        <linearGradient id={accentSignalId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00f5d4" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>
      </defs>

      {/* Main Dark circular base */}
      <circle cx="60" cy="62" r="50" fill={`url(#${bgGradId})`} stroke="#132c33" strokeWidth="2.5" />

      {/* Concentric Signal Arcs (top-half rings) */}
      <path
        d="M 28 64 A 32 32 0 0 1 92 64"
        fill="none"
        stroke="#ffffff"
        strokeWidth="5.5"
        strokeLinecap="round"
        opacity="0.9"
      />
      <path
        d="M 38 64 A 22 22 0 0 1 82 64"
        fill="none"
        stroke="#ffffff"
        strokeWidth="5.5"
        strokeLinecap="round"
        opacity="0.9"
      />
      <path
        d="M 48 64 A 12 12 0 0 1 72 64"
        fill="none"
        stroke="#ffffff"
        strokeWidth="5.5"
        strokeLinecap="round"
        opacity="0.9"
      />

      {/* Overlapping Waves on Bottom Half */}
      {/* Wave layer 1 (Deep Blue/Teal) */}
      <path
        d="M 12 68 Q 36 50, 60 68 T 108 68 L 108 102 A 50 50 0 0 1 12 102 Z"
        fill={`url(#${deepWaveId})`}
      />

      {/* Wave layer 2 (Medium Teal/Cyan) */}
      <path
        d="M 11 76 Q 36 60, 60 76 T 109 76 L 109 104 A 50 50 0 0 1 11 104 Z"
        fill={`url(#${midWaveId})`}
        opacity="0.9"
      />

      {/* Wave layer 3 (Front Bright Cyan/Green) */}
      <path
        d="M 12 84 Q 36 70, 60 84 T 108 84 L 108 106 A 50 50 0 0 1 12 106 Z"
        fill={`url(#${frontWaveId})`}
      />

      {/* Small wireless broadcast icon in upper-right corner */}
      <path
        d="M 94 28 A 12 12 0 0 1 106 40"
        fill="none"
        stroke={`url(#${accentSignalId})`}
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path
        d="M 94 20 A 20 20 0 0 1 114 40"
        fill="none"
        stroke={`url(#${accentSignalId})`}
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path
        d="M 94 12 A 28 28 0 0 1 122 40"
        fill="none"
        stroke={`url(#${accentSignalId})`}
        strokeWidth="3.5"
        strokeLinecap="round"
      />

      {/* Trademark MW emblem on lower right edge */}
      <circle cx="100" cy="100" r="7.5" fill="#081e26" stroke="#132c33" strokeWidth="1.5" />
      <text
        x="100"
        y="102"
        fill="#00f5d4"
        fontSize="6.5"
        fontWeight="bold"
        textAnchor="middle"
        fontFamily="sans-serif"
      >
        M
      </text>
    </svg>
  );
}

export function MiniLogo({ className = '', size = 20 }: LogoProps) {
  return (
    <Logo size={size} className={className} />
  );
}
