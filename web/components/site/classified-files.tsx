'use client';

import clsx from 'clsx';
import { BadgeCheck, Lock, MessageSquareText, Unlock } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { Reveal, RevealText } from '@/components/ui/reveal';
import { TILE, TileGrid } from '@/components/ui/tiles';
import { useLaunch } from '@/lib/launch-context';
import { SectionHeading } from './section-heading';

/** A redaction bar that slides away when the files are declassified. */
function Redacted({ children, open, width }: { children: string; open: boolean; width?: string }) {
  return (
    <span className="relative inline-block align-baseline">
      <span
        className={clsx(
          'transition-colors duration-500',
          open ? 'text-accent-text' : 'text-transparent',
        )}
      >
        {children}
      </span>
      <AnimatePresence>
        {!open && (
          <motion.span
            aria-hidden
            initial={false}
            exit={{ scaleX: 0, transition: { duration: 0.6, ease: [0.65, 0, 0.35, 1] } }}
            style={{ width }}
            className="absolute inset-x-[-2px] top-[0.12em] bottom-[0.02em] origin-right bg-surface-3"
          />
        )}
      </AnimatePresence>
      {!open && <span className="sr-only">[classified]</span>}
    </span>
  );
}

function FileVisual({ index, open }: { index: number; open: boolean }) {
  return (
    <div
      className={clsx(
        'relative mt-auto overflow-hidden border border-hairline bg-canvas p-4 transition-[filter,opacity] duration-700',
        open ? 'opacity-100 blur-0' : 'opacity-50 blur-[6px] select-none',
      )}
      aria-hidden={!open}
    >
      {index === 0 && (
        <div className="flex items-center gap-3">
          <div className="h-10 w-14 rounded-[2px] bg-[#1a3a8f] p-1.5 text-right text-[0.55rem] font-black italic text-white">
            VISA
          </div>
          <motion.div
            className="h-px flex-1 bg-[repeating-linear-gradient(90deg,var(--xd-text-3)_0_4px,transparent_4px_8px)]"
            animate={open ? { backgroundPositionX: ['0px', '16px'] } : {}}
            transition={{ duration: 0.6, repeat: Infinity, ease: 'linear' }}
          />
          <div className="border border-hairline-strong px-2 py-1.5 text-[0.62rem] font-bold text-ink">
            MTN MoMo
          </div>
        </div>
      )}
      {index === 1 && (
        <dl className="space-y-1.5 text-[0.75rem]">
          <div className="flex justify-between">
            <dt className="text-ink-3">They receive</dt>
            <dd className="font-bold text-ink tnum">RWF 12,000</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-3">Fee</dt>
            <dd className="text-ink tnum">RWF 380</dd>
          </div>
          <div className="flex justify-between border-t border-hairline pt-1.5">
            <dt className="font-bold text-ink">You pay</dt>
            <dd className="font-bold text-ink tnum">USD 8.54</dd>
          </div>
        </dl>
      )}
      {index === 2 && (
        <div className="space-y-2 text-[0.72rem]">
          <div className="flex items-center gap-2 text-ink">
            <BadgeCheck className="size-3.5 text-success" /> Receipt XD-7K2M4Q
          </div>
          <div className="flex items-center gap-2 text-ink-2">
            <MessageSquareText className="size-3.5" /> “You received RWF 12,000 via XenDirekt”
          </div>
        </div>
      )}
    </div>
  );
}

const FILES = [
  {
    parts: (open: boolean) => (
      <>
        Your <Redacted open={open}>card</Redacted> → any{' '}
        <Redacted open={open}>MoMo wallet</Redacted> in Rwanda.
      </>
    ),
    note: 'At the shop counter or to family back home.',
  },
  {
    parts: (open: boolean) => (
      <>
        The exact <Redacted open={open}>amount in RWF</Redacted>, before you tap pay.
      </>
    ),
    note: 'No more guessing what actually arrives.',
  },
  {
    parts: (open: boolean) => (
      <>
        A <Redacted open={open}>receipt</Redacted> the second it{' '}
        <Redacted open={open}>lands</Redacted>.
      </>
    ),
    note: 'Both sides know. Nobody refreshes anything.',
  },
];

export function ClassifiedFiles() {
  const { declassified } = useLaunch();
  return (
    <section id="files" className="scroll-mt-20 border-t border-hairline py-24 sm:py-32">
      <div className="container-x">
        <SectionHeading
          eyebrow={declassified ? 'Declassified · for your eyes' : 'Coming soon · Classified'}
          title="Three things we can’t fully tell you. [Yet.]"
          aside={
            declassified ? (
              <span className="inline-flex items-center gap-2 text-ink">
                <Unlock className="size-4 text-accent-text" /> Files declassified. Thanks for
                checking your hustle.
              </span>
            ) : (
              <>
                Finish the{' '}
                <Link
                  href="#check"
                  className="font-bold text-ink underline decoration-accent decoration-2 underline-offset-4"
                >
                  Hustle Check
                </Link>{' '}
                to declassify the files.
              </>
            )
          }
        />
        <TileGrid className="mt-12 md:grid-cols-3">
          {FILES.map((file, index) => (
            <Reveal
              key={index}
              delay={index * 0.08}
              className={clsx(
                TILE,
                'relative flex min-h-[340px] flex-col bg-tile p-8 transition-colors duration-700',
                declassified ? 'hover:bg-tile-hover' : 'hatch',
              )}
            >
              <div className="flex items-center justify-between">
                <p className="mono text-[0.72rem] tracking-[0.12em] text-ink-3 uppercase">
                  File 0{index + 1}
                </p>
                {declassified ? (
                  <motion.span
                    initial={{ scale: 1.6, opacity: 0, rotate: -12 }}
                    animate={{ scale: 1, opacity: 1, rotate: -6 }}
                    transition={{
                      delay: 0.4 + index * 0.15,
                      type: 'spring',
                      stiffness: 300,
                      damping: 14,
                    }}
                    className="mono border-2 border-accent px-1.5 py-0.5 text-[0.6rem] font-bold tracking-[0.14em] text-accent-text"
                  >
                    DECLASSIFIED
                  </motion.span>
                ) : (
                  <Lock className="size-4 text-ink-3" />
                )}
              </div>
              <p className="mt-5 text-[1.5rem] leading-[1.3] font-medium tracking-[-0.054em] text-ink">
                {file.parts(declassified)}
              </p>
              <RevealText
                delay={0.3 + index * 0.1}
                text={file.note}
                className="mt-4 text-[0.92rem] text-ink-2"
              />
              <div className="mt-6 flex flex-1 flex-col">
                <FileVisual index={index} open={declassified} />
              </div>
            </Reveal>
          ))}
        </TileGrid>
      </div>
    </section>
  );
}
