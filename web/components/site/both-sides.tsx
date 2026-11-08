'use client';

import clsx from 'clsx';
import { BadgeCheck, MessageSquareText, ShieldCheck } from 'lucide-react';
import { motion, useScroll, useTransform } from 'motion/react';
import { useRef } from 'react';
import { Reveal, RevealWords } from '@/components/ui/reveal';
import { ScrollWords } from '@/components/ui/text-effects';
import { TILE, TileGrid } from '@/components/ui/tiles';

/** Linear-style feature block: statement left, detail right, a product visual that lights up on scroll. */
export function BothSides() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'center center'] });
  const opacity = useTransform(scrollYProgress, [0, 1], [0.35, 1]);
  const lift = useTransform(scrollYProgress, [0, 1], [60, 0]);

  return (
    <section className="border-t border-hairline py-24 sm:py-32">
      <div className="container-x">
        <div className="grid gap-8 md:grid-cols-2">
          <RevealWords
            text="Built for both sides [of the counter]"
            className="display max-w-[12ch] text-ink"
          />
          <Reveal delay={0.15} className="md:pt-3">
            <ScrollWords
              text="The payer sees the seller’s registered name and the exact amount before paying. The seller gets an SMS the moment it lands. Your card is only charged once the payout is confirmed."
              className="text-[clamp(1.15rem,1.8vw,1.55rem)] leading-[1.35] tracking-[-0.046em] text-ink"
            />
          </Reveal>
        </div>
        <motion.div ref={ref} style={{ opacity, y: lift }} className="relative mt-16">
          <TileGrid className="lg:grid-cols-3">
            <div
              aria-hidden
              className="grid-lines pointer-events-none absolute inset-0 opacity-50 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]"
            />
            <Panel
              step="01"
              title="Verified before you pay"
              icon={<BadgeCheck className="size-4 text-success" />}
            >
              <div className="border border-hairline bg-canvas p-3.5">
                <p className="text-[0.7rem] text-ink-3">MoMo number</p>
                <p className="font-bold tracking-[-0.032em] text-ink tnum">078 812 3456</p>
              </div>
              <div className="-mt-px flex items-center gap-2.5 border border-hairline bg-canvas p-3.5">
                <span className="grid size-8 place-items-center rounded-full bg-surface-3 text-[0.72rem] font-bold">
                  KC
                </span>
                <div>
                  <p className="text-[0.9rem] font-bold tracking-[-0.032em] text-ink">
                    Kigali Crafts Co.
                  </p>
                  <p className="text-[0.72rem] text-success">Registered name verified</p>
                </div>
              </div>
            </Panel>
            <Panel
              step="02"
              title="Held, then charged"
              icon={<ShieldCheck className="size-4 text-accent-text" />}
            >
              {[
                ['Card authorised', 'Held, not charged', true],
                ['Payout confirmed', 'Seller has the money', true],
                ['Card charged', 'Only now', true],
              ].map(([t, s], i) => (
                <motion.div
                  key={t as string}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 + i * 0.25 }}
                  className="flex items-center gap-3 border-b border-hairline py-2.5 last:border-0"
                >
                  <span className="grid size-6 place-items-center rounded-full bg-accent text-[0.7rem] font-bold text-on-accent">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-[0.88rem] font-bold tracking-[-0.032em] text-ink">{t}</p>
                    <p className="text-[0.72rem] text-ink-3">{s}</p>
                  </div>
                </motion.div>
              ))}
            </Panel>
            <Panel
              step="03"
              title="The seller knows instantly"
              icon={<MessageSquareText className="size-4 text-info" />}
            >
              <div className="mx-auto w-full max-w-[250px] rounded-[26px] border-[5px] border-surface-3 bg-canvas p-3">
                <p className="mono text-center text-[0.6rem] text-ink-3">Messages · now</p>
                <motion.div
                  initial={{ opacity: 0, y: 12, scale: 0.95 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.6, type: 'spring', stiffness: 260, damping: 20 }}
                  className="mt-2 rounded-[14px] rounded-bl-[4px] bg-surface-2 p-3 text-[0.75rem] leading-snug text-ink"
                >
                  You received RWF 18,000 from Ana via XenDirekt. Ref XD-7K2M4Q.
                  <span className="mt-1 block text-ink-3">Wakiriye RWF 18,000…</span>
                </motion.div>
              </div>
            </Panel>
          </TileGrid>
        </motion.div>
      </div>
    </section>
  );
}

function Panel({
  step,
  title,
  icon,
  children,
}: {
  step: string;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className={clsx(
        TILE,
        'relative bg-tile p-7 transition-colors duration-500 hover:bg-tile-hover',
      )}
    >
      <div className="mb-5 flex items-center justify-between">
        <p className="flex items-center gap-2 text-[0.95rem] font-bold tracking-[-0.046em] text-ink">
          {icon}
          {title}
        </p>
        <span className="mono text-[0.68rem] text-ink-3">{step}</span>
      </div>
      {children}
    </div>
  );
}
