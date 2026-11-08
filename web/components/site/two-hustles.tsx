'use client';

import clsx from 'clsx';
import { motion } from 'motion/react';
import { Reveal, RevealText } from '@/components/ui/reveal';
import { TILE, TileGrid } from '@/components/ui/tiles';
import { SectionHeading } from './section-heading';

const STORY_TILE = clsx(
  TILE,
  'relative flex min-h-[320px] flex-col bg-tile p-8 transition-colors duration-500 hover:bg-tile-hover',
);

export function TwoHustles() {
  return (
    <section className="border-t border-hairline py-24 sm:py-32">
      <div className="container-x">
        <SectionHeading
          eyebrow="Two hustles. One problem."
          title="[Whether you’re at the counter or across the world,] it’s the same gap."
        />
        <TileGrid className="mt-12 md:grid-cols-3">
          <Reveal className={STORY_TILE}>
            <p className="mono text-[0.72rem] tracking-[0.12em] text-ink-3 uppercase">
              The visitor
            </p>
            <RevealText
              delay={0.2}
              text="You found the perfect basket. The seller takes cash or MoMo. You have a card."
              className="mt-5 text-[1.5rem] leading-[1.22] font-medium tracking-[-0.054em] text-ink"
            />
            <RevealText
              delay={0.6}
              stagger={0.015}
              text="Cue the ATM hunt, the fees, or walking away empty-handed."
              className="mt-auto pt-6 text-[0.92rem] leading-relaxed text-ink-2"
            />
          </Reveal>
          <Reveal
            delay={0.1}
            className={clsx(
              TILE,
              'relative flex min-h-[320px] flex-col justify-center overflow-hidden bg-accent p-8 text-on-accent',
            )}
          >
            <motion.div
              aria-hidden
              className="absolute -right-10 -bottom-12 opacity-[0.14]"
              animate={{ rotate: 360 }}
              transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
            >
              <svg width="220" height="220" viewBox="0 0 100 100">
                <polygon
                  points="25.4,15.2 54.2,44.2 16.7,80.8 35.8,44.4 25.4,33.8"
                  fill="currentColor"
                />
                <polygon
                  points="83.1,18.8 45.8,55.8 74.6,84.6 74.6,66.3 64.2,55.8"
                  fill="currentColor"
                />
              </svg>
            </motion.div>
            <p className="mono text-[0.72rem] tracking-[0.16em] uppercase">The common ground</p>
            <RevealText
              delay={0.35}
              stagger={0.05}
              text="Money from outside. A MoMo wallet inside. Too much in between."
              className="relative mt-5 text-[1.75rem] leading-[1.12] font-bold tracking-[-0.066em]"
            />
          </Reveal>
          <Reveal delay={0.2} className={STORY_TILE}>
            <p className="mono text-[0.72rem] tracking-[0.12em] text-ink-3 uppercase">The sender</p>
            <RevealText
              delay={0.4}
              text="School fees are due Friday. You sent the money Monday. It’s still “processing”."
              className="mt-5 text-[1.5rem] leading-[1.22] font-medium tracking-[-0.054em] text-ink"
            />
            <RevealText
              delay={0.8}
              stagger={0.015}
              text="Cue the fees, the waiting, and the “did it arrive?” calls."
              className="mt-auto pt-6 text-[0.92rem] leading-relaxed text-ink-2"
            />
          </Reveal>
        </TileGrid>
      </div>
    </section>
  );
}
