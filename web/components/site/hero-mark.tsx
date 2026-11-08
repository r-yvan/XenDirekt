'use client';

import clsx from 'clsx';
import { motion, useScroll, useTransform } from 'motion/react';

/**
 * The XenDirekt X, oversized, faint and leaning left, centred behind the hero. Greys only: the
 * sending leg (orange in the logo) is a shade brighter than the receiving one. Geometry
 * matches LogoMark.
 */
export function HeroMark({ className }: { className?: string }) {
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 1000], [0, 140]);
  return (
    <motion.div aria-hidden style={{ y }} className={clsx('pointer-events-none', className)}>
      <motion.svg
        viewBox="0 0 100 100"
        className="absolute top-1/2 left-1/2 w-[min(1700px,260vw)] max-w-none -translate-x-1/2 -translate-y-1/2"
        initial={{ opacity: 0, rotate: -6, scale: 1.04 }}
        animate={{ opacity: 1, rotate: -14, scale: 1 }}
        transition={{ duration: 2, ease: [0.22, 1, 0.36, 1] }}
      >
        <defs>
          <linearGradient id="xd-hero-mark-hi" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: 'var(--xd-mark-hi)' }} />
            <stop offset="1" style={{ stopColor: 'var(--xd-mark-hi)' }} stopOpacity={0.35} />
          </linearGradient>
          <linearGradient id="xd-hero-mark-lo" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: 'var(--xd-mark-lo)' }} />
            <stop offset="1" style={{ stopColor: 'var(--xd-mark-lo)' }} stopOpacity={0.35} />
          </linearGradient>
        </defs>
        <polygon
          points="25.4,15.2 54.2,44.2 16.7,80.8 35.8,44.4 25.4,33.8"
          fill="url(#xd-hero-mark-hi)"
        />
        <polygon
          points="83.1,18.8 45.8,55.8 74.6,84.6 74.6,66.3 64.2,55.8"
          fill="url(#xd-hero-mark-lo)"
        />
      </motion.svg>
    </motion.div>
  );
}
