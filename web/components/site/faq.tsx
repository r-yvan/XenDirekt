'use client';

import clsx from 'clsx';
import { Plus } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { Reveal, RevealText } from '@/components/ui/reveal';
import { CardStack } from './card-stack';
import { SectionHeading } from './section-heading';

const ITEMS: [question: string, answer: string][] = [
  [
    'Can I use XenDirekt today?',
    'Not yet. XenDirekt is in development and doesn’t move real money. Join the waitlist and we’ll email you when your access is ready.',
  ],
  [
    'Who is it for?',
    'Visitors paying shops, guides and drivers in Rwanda, and anyone abroad sending money to family and friends there. You pay with your own Visa or Mastercard; they receive it in their MTN MoMo wallet.',
  ],
  [
    'Which wallets and cards?',
    'MTN MoMo wallets in Rwanda first. Visa and Mastercard cards issued outside Rwanda.',
  ],
  [
    'What will it cost?',
    'You’ll see the exact RWF amount, the fee and the rate before you pay, and nothing else is added. Final pricing is set before launch.',
  ],
  [
    'Is my card safe?',
    'Card details are typed into our licensed payment partner’s page, never into XenDirekt. Your card is held first and only charged after the payout is confirmed; if it fails, the hold is released.',
  ],
  [
    'What happens to my email?',
    'It’s used only to tell you about the launch. Every email has a link to leave the list and delete your details.',
  ],
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="scroll-mt-20 border-t border-hairline py-24 sm:py-32">
      <div className="container-x grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionHeading eyebrow="Questions" title="The short [answers.]" />
          <CardStack className="mt-12 hidden lg:block" />
        </div>
        <Reveal className="divide-y divide-hairline border-y border-hairline">
          {ITEMS.map(([question, answer], index) => {
            const expanded = open === index;
            return (
              <div key={question}>
                <button
                  className="flex w-full items-center justify-between gap-6 py-5 text-left text-[1.15rem] font-bold tracking-[-0.046em] text-ink"
                  aria-expanded={expanded}
                  onClick={() => setOpen(expanded ? null : index)}
                >
                  {question}
                  <span
                    className={clsx(
                      'grid size-8 shrink-0 place-items-center border transition-colors',
                      expanded
                        ? 'border-accent text-accent-text'
                        : 'border-hairline-strong text-ink-2',
                    )}
                  >
                    {/* Only the icon turns (plus → close); the square stays square. */}
                    <motion.span animate={{ rotate: expanded ? 45 : 0 }} className="grid">
                      <Plus className="size-4" />
                    </motion.span>
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {expanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <RevealText
                        trigger="mount"
                        delay={0.1}
                        stagger={0.012}
                        text={answer}
                        className="max-w-[60ch] pb-6 text-[1.02rem] leading-relaxed text-ink-2"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </Reveal>
      </div>
    </section>
  );
}
