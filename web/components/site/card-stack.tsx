'use client';

import clsx from 'clsx';
import { motion } from 'motion/react';
import { BankCard } from '@/components/ui/bank-card';

/**
 * An eased falloff (many stops) from the card's top-right corner: clear there, gone by the
 * bottom-left, with no visible edge in between.
 */
const FADE =
  'radial-gradient(125% 160% at 100% 0%, rgb(0 0 0) 0%, rgb(0 0 0 / 0.9) 14%, rgb(0 0 0 / 0.72) 26%, rgb(0 0 0 / 0.52) 38%, rgb(0 0 0 / 0.34) 50%, rgb(0 0 0 / 0.19) 61%, rgb(0 0 0 / 0.08) 71%, rgb(0 0 0 / 0.02) 80%, transparent 88%)';

/**
 * How far the card reaches left past its column: 30% of the column, but never more than the
 * page margin, so it stays on screen on smaller laptops. Mirrors .container-x (max 1200px,
 * 32px padding).
 */
const BLEED = 'min(30%, max(0px, (100vw - 1200px) / 2) + 32px)';

/** One large monochrome Visa card, straight, clear at its top-right corner and fading out. */
export function CardStack({ className }: { className?: string }) {
  return (
    <motion.div
      aria-hidden
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-10% 0px' }}
      transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
      className={clsx('relative', className)}
    >
      {/* Wider than its column and nudged left: the overflow on the left is already faded out.
          The mask rides on the floating element so the fade stays fixed to the card. */}
      <motion.div
        style={{
          marginLeft: `calc(-1 * ${BLEED})`,
          width: `calc(94% + ${BLEED})`,
          maskImage: FADE,
          WebkitMaskImage: FADE,
        }}
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
      >
        <BankCard brand="VISA" tone="mono" last4="4242" className="opacity-60" />
      </motion.div>
    </motion.div>
  );
}
