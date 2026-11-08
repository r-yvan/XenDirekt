'use client';

import clsx from 'clsx';
import { Menu, X } from 'lucide-react';
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'motion/react';
import Link from 'next/link';
import { useState } from 'react';
import { ButtonLink } from '@/components/ui/button';
import { Logo } from '@/components/ui/logo';
import { RollText, ScrambleText } from '@/components/ui/text-effects';
import { ThemeToggle } from '@/components/ui/theme-toggle';

const LINKS = [
  { href: '/#files', label: 'The idea' },
  { href: '/#check', label: 'Hustle Check' },
  { href: '/#wall', label: 'Wall of Hustle' },
  { href: '/#faq', label: 'FAQ' },
];

export function SiteNav() {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useMotionValueEvent(scrollY, 'change', (y) => setScrolled(y > 24));

  return (
    <header
      className={clsx(
        'fixed inset-x-0 top-0 z-50 transition-[background,border-color,backdrop-filter] duration-300',
        scrolled || open
          ? 'border-b border-hairline bg-canvas/75 backdrop-blur-xl'
          : 'border-b border-transparent',
      )}
    >
      <nav className="container-x flex h-16 items-center justify-between gap-4" aria-label="Main">
        <div className="flex items-center gap-8">
          <Logo />
          <ul className="hidden items-center gap-1 lg:flex">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="group/roll inline-flex rounded-lg px-3 py-2 text-[0.9rem] font-medium text-ink-2 transition-colors hover:text-ink"
                >
                  <RollText>{link.label}</RollText>
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="mono hidden items-center gap-2 rounded-full border border-hairline-strong px-3 py-1.5 text-[0.7rem] text-ink-2 xl:inline-flex">
            <span className="size-1.5 rounded-full bg-accent [animation:xd-pulse-dot_2s_ease-in-out_infinite]" />
            <ScrambleText
              trigger="mount"
              delay={0.3}
              duration={1200}
              text="Building in Kigali · Coming soon"
            />
          </span>
          <span className="hidden sm:block">
            <ThemeToggle />
          </span>
          <Link
            href="/sign-in"
            className="hidden rounded-lg px-3 py-2 text-[0.9rem] font-medium text-ink-2 transition-colors hover:text-ink md:inline-block"
          >
            Sign in
          </Link>
          <span className="hidden sm:block">
            <ButtonLink href="/#join" size="sm" roll>
              Join the waitlist
            </ButtonLink>
          </span>
          <button
            className="grid size-10 place-items-center rounded-lg text-ink lg:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </nav>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden lg:hidden"
          >
            <div className="container-x flex flex-col gap-1 pb-5">
              {[...LINKS, { href: '/sign-in', label: 'Sign in' }].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-1 py-3 text-lg font-medium tracking-[-0.046em] text-ink"
                >
                  {link.label}
                </Link>
              ))}
              <div className="mt-3 flex items-center justify-between">
                <ThemeToggle />
                <ButtonLink href="/#join" onClick={() => setOpen(false)}>
                  Join the waitlist
                </ButtonLink>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
