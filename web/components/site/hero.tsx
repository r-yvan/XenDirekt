'use client';

import { ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { ButtonLink } from '@/components/ui/button';
import { RevealText, RevealWords } from '@/components/ui/reveal';
import { ScrambleText } from '@/components/ui/text-effects';
import { HeroMark } from './hero-mark';
import { PortalGlimpse } from './portal-glimpse';

const ease = [0.22, 1, 0.36, 1] as const;

export function Hero() {
  return (
    <section className="relative isolate pt-44 pb-16 sm:pt-[15rem] sm:pb-20 lg:pt-[19.5rem] lg:pb-24">
      <HeroMark className="absolute inset-x-0 top-0 -z-10 h-[1000px] [mask-image:linear-gradient(to_bottom,black_55%,transparent_92%)]" />
      <div className="container-x relative flex flex-col items-center text-center">
        <RevealWords
          as="h1"
          trigger="mount"
          delay={0.15}
          stagger={0.09}
          text="Paying into Rwanda [shouldn’t be] a hustle."
          className="display-xl max-w-[15ch] text-ink"
        />
        <p className="mt-6 max-w-[36rem] text-[1rem] leading-[1.55] tracking-[-0.028em] text-ink-2 sm:text-[1.06rem]">
          <RevealText
            as="span"
            trigger="mount"
            delay={0.75}
            stagger={0.018}
            text="A card declined at a craft stall in Kigali. Money for family stuck at 99%. Different moments, same problem: money from outside Rwanda struggling to reach a wallet inside it."
          />{' '}
          <RevealText
            as="span"
            trigger="mount"
            delay={1.25}
            stagger={0.06}
            text="We’re building the bridge."
            className="text-ink"
          />
        </p>
        <motion.div
          initial={{ opacity: 0, y: 16, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.9, delay: 1.1, ease }}
          className="mt-8 flex flex-wrap items-center justify-center gap-3"
        >
          <ButtonLink href="/sign-in?new=1" size="lg" shape="pill" roll>
            Create account <ArrowRight className="size-4.5" />
          </ButtonLink>
          <ButtonLink href="/sign-in" size="lg" variant="secondary" shape="pill" roll>
            Sign in
          </ButtonLink>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.35, duration: 0.8, ease }}
          className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2"
        >
          <Link
            href="/#check"
            className="group inline-flex items-center gap-1.5 text-[0.875rem] font-bold tracking-[-0.03em] text-ink"
          >
            Or check your hustle first
            <ArrowRight className="size-3.5 text-accent-text transition-transform group-hover:translate-x-1" />
          </Link>
          <ScrambleText
            trigger="mount"
            delay={1.4}
            duration={1100}
            text="60 seconds · 5 taps · no sign-up"
            className="mono text-[0.66rem] text-ink-3"
          />
        </motion.div>
      </div>
      {/* The portal preview is wider than the text column, like a product screenshot. */}
      <motion.div
        initial={{ opacity: 0, y: 70 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.3, delay: 0.7, ease }}
        className="mx-auto mt-8 w-full max-w-[1400px] px-5 sm:mt-10 sm:px-8"
      >
        <PortalGlimpse />
      </motion.div>
    </section>
  );
}
