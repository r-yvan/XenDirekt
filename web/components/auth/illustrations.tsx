'use client';

import { motion, useReducedMotion } from 'motion/react';

/**
 * Animated auth illustrations: line art in the ink colours with #FF640A as the only accent.
 * Each one tells its step's story and loops calmly; with reduced motion they render the final
 * frame, still.
 */
const ORANGE = '#FF640A';
const draw = (delay = 0, duration = 0.9) => ({
  initial: { pathLength: 0, opacity: 0 },
  animate: { pathLength: 1, opacity: 1 },
  transition: {
    pathLength: { delay, duration, ease: [0.65, 0, 0.35, 1] as const },
    opacity: { delay, duration: 0.01 },
  },
});

function Frame({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <svg
      viewBox="0 0 320 260"
      role="img"
      aria-label={label}
      className="h-auto w-full max-w-[380px] text-ink-3"
    >
      {children}
    </svg>
  );
}

function useLoop(seconds: number) {
  const reduced = useReducedMotion();
  return reduced
    ? { repeat: 0, duration: 0 }
    : { repeat: Infinity, duration: seconds, ease: 'easeInOut' as const };
}

/** Sign in: a letter carrying a code rises from an envelope; a paper plane loops around. */
export function EmailIllustration() {
  const loop = useLoop(4);
  return (
    <Frame label="An email with your sign-in code on its way">
      <motion.path
        d="M30 70 C 90 10, 200 20, 240 60"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="4 6"
        {...draw(0.2, 1.4)}
      />
      <motion.g
        initial={{ x: 0, y: 0, rotate: 0 }}
        animate={{ x: [0, 18, 0], y: [0, -10, 0], rotate: [0, -6, 0] }}
        transition={loop}
        style={{ originX: '250px', originY: '55px' }}
      >
        <path
          d="M232 52 L272 36 L258 72 L250 58 Z"
          fill="var(--xd-surface-1)"
          stroke={ORANGE}
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="M250 58 L272 36" stroke={ORANGE} strokeWidth="2" />
      </motion.g>
      <motion.g animate={{ y: [0, -14, 0] }} transition={loop}>
        <rect
          x="104"
          y="78"
          width="112"
          height="86"
          rx="10"
          fill="var(--xd-surface-1)"
          stroke="currentColor"
          strokeWidth="2"
        />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <motion.rect
            key={i}
            x={118 + i * 15}
            y={102}
            width={11}
            height={16}
            rx={3}
            fill={ORANGE}
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: [0, 1, 1, 0], scale: [0.4, 1, 1, 0.4] }}
            transition={{ ...loop, delay: 0.15 * i, duration: loop.duration || 0 }}
            style={{ originX: `${124 + i * 15}px`, originY: '110px' }}
          />
        ))}
        <rect x="118" y="130" width="64" height="6" rx="3" fill="currentColor" opacity="0.35" />
        <rect x="118" y="142" width="44" height="6" rx="3" fill="currentColor" opacity="0.2" />
      </motion.g>
      <path
        d="M82 132 L160 186 L238 132 V 214 H 82 Z"
        fill="var(--xd-surface-2)"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <motion.path
        d="M82 214 L140 170 M238 214 L180 170"
        stroke="currentColor"
        strokeWidth="2"
        {...draw(0.4)}
      />
      <motion.circle
        cx="238"
        cy="132"
        r="12"
        fill={ORANGE}
        initial={{ scale: 0 }}
        animate={{ scale: [0, 1.15, 1] }}
        transition={{ delay: 0.9, duration: 0.5 }}
      />
      <text x="238" y="137" textAnchor="middle" fontSize="13" fontWeight="700" fill="#0A0A0B">
        1
      </text>
    </Frame>
  );
}

/** Verify: the six digits fill in, then the shield checks itself. */
export function CodeIllustration() {
  const loop = useLoop(3.6);
  return (
    <Frame label="Six digits fill in and a shield confirms the code">
      <rect
        x="96"
        y="22"
        width="128"
        height="216"
        rx="22"
        fill="var(--xd-surface-1)"
        stroke="currentColor"
        strokeWidth="2"
      />
      <rect x="140" y="32" width="40" height="6" rx="3" fill="currentColor" opacity="0.3" />
      <motion.g
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <rect x="110" y="56" width="100" height="40" rx="12" fill="var(--xd-surface-2)" />
        <rect x="120" y="68" width="56" height="5" rx="2.5" fill="currentColor" opacity="0.45" />
        <rect x="120" y="79" width="36" height="5" rx="2.5" fill="currentColor" opacity="0.25" />
      </motion.g>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <g key={i}>
          <rect
            x={110 + i * 17}
            y={116}
            width={13}
            height={18}
            rx={4}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <motion.circle
            cx={116.5 + i * 17}
            cy={125}
            r={3.5}
            fill={ORANGE}
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1, 1, 0] }}
            transition={{ ...loop, times: [0, 0.15, 0.85, 1], delay: 0.18 * i }}
          />
        </g>
      ))}
      <motion.g
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: [0.6, 1, 1, 0.6], opacity: [0, 1, 1, 0] }}
        transition={{ ...loop, times: [0.35, 0.5, 0.9, 1], delay: 0.4 }}
        style={{ originX: '160px', originY: '180px' }}
      >
        <path
          d="M160 154 L184 163 V 180 C 184 196, 172 205, 160 210 C 148 205, 136 196, 136 180 V 163 Z"
          fill={ORANGE}
        />
        <path
          d="M149 181 L157 189 L172 172"
          fill="none"
          stroke="#0A0A0B"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </motion.g>
      <motion.circle
        cx="160"
        cy="182"
        r="40"
        fill="none"
        stroke={ORANGE}
        strokeWidth="1.5"
        animate={{ scale: [0.8, 1.4], opacity: [0.5, 0] }}
        transition={{ ...loop, delay: 1.4 }}
        style={{ originX: '160px', originY: '182px' }}
      />
    </Frame>
  );
}

/** Profile: an ID card assembles itself, and a passport stamp lands. */
export function ProfileIllustration() {
  const loop = useLoop(5);
  return (
    <Frame label="An identity card fills in and receives a stamp">
      <motion.g
        animate={{ rotate: [-2, 2, -2] }}
        transition={loop}
        style={{ originX: '160px', originY: '130px' }}
      >
        <rect
          x="50"
          y="62"
          width="220"
          height="136"
          rx="16"
          fill="var(--xd-surface-1)"
          stroke="currentColor"
          strokeWidth="2"
        />
        <rect x="50" y="62" width="220" height="30" rx="16" fill="var(--xd-surface-2)" />
        <rect x="50" y="80" width="220" height="12" fill="var(--xd-surface-2)" />
        <motion.circle
          cx="100"
          cy="140"
          r="26"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          {...draw(0.2)}
        />
        <motion.path
          d="M84 156 C 88 144, 112 144, 116 156"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          {...draw(0.6)}
        />
        <motion.circle
          cx="100"
          cy="131"
          r="8"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          {...draw(0.5)}
        />
        {[0, 1, 2].map((i) => (
          <motion.rect
            key={i}
            x={140}
            y={118 + i * 18}
            height={7}
            rx={3.5}
            fill={i === 0 ? 'var(--xd-text)' : 'currentColor'}
            opacity={i === 0 ? 0.8 : 0.35}
            initial={{ width: 0 }}
            animate={{ width: [0, 100 - i * 24] }}
            transition={{ delay: 0.7 + i * 0.2, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          />
        ))}
      </motion.g>
      <motion.g
        initial={{ scale: 1.8, opacity: 0, rotate: -30 }}
        animate={{ scale: [1.8, 1, 1, 1.8], opacity: [0, 1, 1, 0], rotate: [-30, -12, -12, -30] }}
        transition={{ ...loop, times: [0.3, 0.42, 0.9, 1], delay: 1 }}
        style={{ originX: '236px', originY: '178px' }}
      >
        <circle cx="236" cy="178" r="30" fill="none" stroke={ORANGE} strokeWidth="3" />
        <circle
          cx="236"
          cy="178"
          r="22"
          fill="none"
          stroke={ORANGE}
          strokeWidth="1.5"
          strokeDasharray="3 4"
        />
        <text
          x="236"
          y="183"
          textAnchor="middle"
          fontSize="12"
          fontWeight="800"
          fill={ORANGE}
          letterSpacing="1"
        >
          RW
        </text>
      </motion.g>
    </Frame>
  );
}

/** PIN: a padlock whose dots fill, then the shackle clicks shut. */
export function PinIllustration({ filled = 0 }: { filled?: number }) {
  const loop = useLoop(3.2);
  const reduced = useReducedMotion();
  return (
    <Frame label="A padlock locking as the PIN is entered">
      <motion.path
        d="M118 118 V 88 C 118 52, 202 52, 202 88 V 118"
        fill="none"
        stroke="currentColor"
        strokeWidth="10"
        strokeLinecap="round"
        animate={reduced ? undefined : { y: [-14, 0, 0, -14] }}
        transition={{ ...loop, times: [0, 0.25, 0.85, 1] }}
      />
      <rect
        x="96"
        y="112"
        width="128"
        height="104"
        rx="20"
        fill="var(--xd-surface-1)"
        stroke="currentColor"
        strokeWidth="2"
      />
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const x = 118 + (i % 6) * 17;
        const on = i < filled;
        return (
          <motion.circle
            key={i}
            cx={x}
            cy={164}
            r={5}
            fill={on ? ORANGE : 'none'}
            stroke={on ? ORANGE : 'currentColor'}
            strokeWidth="1.5"
            animate={
              on
                ? { scale: [0.6, 1.25, 1] }
                : filled === 0 && !reduced
                  ? { fill: ['rgba(0,0,0,0)', ORANGE, ORANGE, 'rgba(0,0,0,0)'] }
                  : {}
            }
            transition={
              on ? { duration: 0.3 } : { ...loop, times: [0, 0.2, 0.85, 1], delay: i * 0.12 }
            }
            style={{ originX: `${x}px`, originY: '164px' }}
          />
        );
      })}
      <motion.circle
        cx="160"
        cy="164"
        r="78"
        fill="none"
        stroke={ORANGE}
        strokeWidth="1.5"
        animate={reduced ? undefined : { scale: [0.9, 1.25], opacity: [0.35, 0] }}
        transition={{ ...loop, delay: 0.9 }}
        style={{ originX: '160px', originY: '164px' }}
      />
    </Frame>
  );
}
