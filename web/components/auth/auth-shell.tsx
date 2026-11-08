'use client';

import clsx from 'clsx';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { Logo } from '@/components/ui/logo';
import { RevealWords } from '@/components/ui/reveal';
import { ThemeToggle } from '@/components/ui/theme-toggle';

export function AuthShell({
  step,
  title,
  subtitle,
  illustration,
  caption,
  back,
  children,
}: {
  step?: number;
  title: string;
  subtitle?: React.ReactNode;
  illustration: React.ReactNode;
  caption: string;
  back?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col px-6 py-6 sm:px-12">
        <div className="flex items-center justify-between">
          <Logo />
          <ThemeToggle />
        </div>
        <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center py-12">
          {/* Small screens: the illustration sits above the form. */}
          <div className="mb-8 flex justify-center lg:hidden [&_svg]:max-w-[220px]">
            {illustration}
          </div>
          {back && (
            <Link
              href={back}
              className="mb-8 inline-flex w-fit items-center gap-1.5 text-[0.9rem] font-medium text-ink-2 hover:text-ink"
            >
              <ArrowLeft className="size-4" /> Back
            </Link>
          )}
          {step !== undefined && (
            <div className="mb-6">
              <div className="flex gap-1.5">
                {[1, 2, 3].map((index) => (
                  <span
                    key={index}
                    className="h-1 flex-1 overflow-hidden rounded-full bg-surface-3"
                  >
                    <motion.span
                      className="block h-full bg-accent"
                      initial={{ width: index < step ? '100%' : '0%' }}
                      animate={{ width: index <= step ? '100%' : '0%' }}
                      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </span>
                ))}
              </div>
              <p className="mono mt-2 text-[0.7rem] text-ink-3">Step {step} of 3</p>
            </div>
          )}
          <motion.div
            key={title}
            initial={{ opacity: 0, y: 12, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <RevealWords
              as="h1"
              trigger="mount"
              stagger={0.06}
              text={title}
              className="text-[2.35rem] leading-[1.04] font-bold tracking-[-0.072em] text-ink"
            />
            {subtitle && (
              <p className="mt-3 text-[1.05rem] leading-relaxed text-ink-2">{subtitle}</p>
            )}
            <div className="mt-8">{children}</div>
          </motion.div>
        </div>
        <p className="flex items-center gap-2 text-[0.8rem] text-ink-3">
          <ShieldCheck className="size-4" /> Card details are handled by our licensed payment
          partner.
        </p>
      </div>
      <div className="hidden p-3 lg:block">
        <div
          className={clsx(
            'relative flex h-full flex-col items-center justify-center overflow-hidden rounded-[28px] border border-hairline bg-surface-1',
          )}
        >
          <div className="grid-lines absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />
          <motion.div
            key={caption}
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="relative flex w-full justify-center px-10"
          >
            {illustration}
          </motion.div>
          <p className="relative mt-8 max-w-[24rem] text-center text-[1.05rem] leading-relaxed tracking-[-0.032em] text-ink-2">
            {caption}
          </p>
        </div>
      </div>
    </div>
  );
}
