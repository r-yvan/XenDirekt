'use client';

import { useQuery } from '@tanstack/react-query';
import { Reveal, RevealText, RevealWords } from '@/components/ui/reveal';
import { CountUp, ScrambleText } from '@/components/ui/text-effects';
import { api } from '@/lib/api';
import type { LaunchStats } from '@/lib/types';
import { ParticleGlobe } from './particle-globe';
import { WaitlistForm } from './waitlist-form';

export function FinalCta() {
  const stats = useQuery({
    queryKey: ['launch-stats'],
    queryFn: () => api<LaunchStats>('v1/launch/stats'),
  });
  const total = stats.data?.waitlist.total ?? 0;
  return (
    <section
      id="join"
      className="relative scroll-mt-16 overflow-hidden border-t border-hairline py-24 sm:py-32"
    >
      <div className="container-x grid items-center gap-12 lg:grid-cols-[1fr_1fr]">
        <div>
          <Reveal>
            <ScrambleText as="p" text="Early access" className="eyebrow" />
          </Reveal>
          <RevealWords
            text="[From anywhere,] to any MoMo wallet in Rwanda."
            className="display mt-4 max-w-[13ch] text-ink"
          />
          <Reveal delay={0.2}>
            <RevealText
              delay={0.25}
              text="We’re opening XenDirekt in waves, starting with the people who told us how bad it really is. Get your spot now."
              className="lead mt-6 max-w-[32rem]"
            />
            {/* Social proof only once it means something. */}
            {total >= 50 && (
              <p className="mono mt-4 text-[0.78rem] text-ink-2">
                <CountUp to={total} /> people are already in line
              </p>
            )}
            <div className="mt-8 max-w-[520px]">
              <WaitlistForm source="final-cta" />
            </div>
          </Reveal>
        </div>
        <Reveal
          delay={0.1}
          className="relative aspect-square w-full max-w-[620px] justify-self-center"
        >
          {/* Soft orange backlight behind the particles. */}
          <div aria-hidden className="globe-backlight absolute inset-[4%] rounded-full" />
          <ParticleGlobe className="absolute inset-0 size-full" />
          <span className="mono absolute right-[8%] bottom-[14%] rounded-full border border-hairline-strong bg-canvas/80 px-3 py-1.5 text-[0.7rem] text-ink-2 backdrop-blur">
            <span className="mr-1.5 inline-block size-1.5 rounded-full bg-accent" />
            Kigali, Rwanda
          </span>
        </Reveal>
      </div>
    </section>
  );
}
