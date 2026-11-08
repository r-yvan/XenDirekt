'use client';

import clsx from 'clsx';
import {
  ArrowUpRight,
  BadgeCheck,
  Bell,
  CircleHelp,
  CreditCard,
  History,
  Lock,
  Search,
  Send,
  Smartphone,
} from 'lucide-react';
import { AnimatePresence, motion, useInView, useScroll, useTransform } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { LogoMark } from '@/components/ui/logo';

/**
 * A glimpse of the web portal, built from the same visual language as /app. The figures are
 * consistent with the API's sandbox pricing (fixed RWF 200 + 1.5%, 1 USD = 1,450 RWF).
 */
const NUMBER = '078 812 3456';
const STEPS = 9;
const STEP_MS = [1500, 900, 1100, 1300, 900, 1000, 1100, 1300, 3200];

export function PortalGlimpse() {
  const frame = useRef<HTMLDivElement>(null);
  const inView = useInView(frame, { margin: '-10% 0px' });
  const { scrollYProgress } = useScroll({ target: frame, offset: ['start end', 'start 0.25'] });
  const rotateX = useTransform(scrollYProgress, [0, 1], [12, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.95, 1]);
  const y = useTransform(scrollYProgress, [0, 1], [30, 0]);
  const [step, setStep] = useState(0);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const timer = setTimeout(() => {
      if (step === STEPS - 1) setCycle((c) => c + 1);
      setStep((step + 1) % STEPS);
    }, STEP_MS[step]);
    return () => clearTimeout(timer);
  }, [step, inView]);

  const verified = step >= 1;
  const amountShown = step >= 2;
  const quoteShown = step >= 3;
  const paying = step >= 4;
  const authorised = step >= 5;
  const sent = step >= 6;
  const received = step >= 7;

  return (
    <div className="relative [perspective:1600px]" ref={frame}>
      <motion.div
        style={{ rotateX, scale, y, transformOrigin: 'center top' }}
        className="relative mx-auto w-full"
      >
        <FrameGlow />
        <div className="relative overflow-hidden rounded-[20px] border border-hairline-strong bg-canvas shadow-[var(--xd-shadow)]">
          {/* Window chrome */}
          <div className="flex h-10 items-center gap-2 border-b border-hairline bg-surface-1 px-4">
            <span className="size-2.5 rounded-full bg-ink-3/30" />
            <span className="size-2.5 rounded-full bg-ink-3/30" />
            <span className="size-2.5 rounded-full bg-ink-3/30" />
            <div className="mono mx-auto flex items-center gap-1.5 rounded-md bg-surface-2 px-3 py-1 text-[0.68rem] text-ink-3">
              <Lock className="size-3" /> app.xendirekt.rw/send
            </div>
          </div>
          <div className="grid min-h-[600px] grid-cols-1 md:grid-cols-[230px_1fr] lg:grid-cols-[248px_1fr_340px]">
            <Sidebar />
            {/* Send */}
            <div className="border-hairline p-5 sm:p-7 lg:border-r">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[0.75rem] font-medium text-ink-3">Send to MoMo</p>
                  <h3 className="text-[1.45rem] font-bold tracking-[-0.06em] text-ink">
                    Who are you paying?
                  </h3>
                </div>
                <span className="mono rounded-full border border-hairline px-2.5 py-1 text-[0.65rem] text-ink-3">
                  MTN MoMo · Rwanda
                </span>
              </div>
              <div className="mt-5 rounded-[14px] border border-accent bg-surface-1 px-4 py-3 shadow-[0_0_0_4px_rgb(255_100_10/0.1)]">
                <p className="text-[0.68rem] font-bold tracking-[-0.02em] text-accent-text">
                  MoMo number
                </p>
                <p className="mt-0.5 flex items-center text-[1.05rem] font-bold tracking-[-0.032em] text-ink tnum">
                  <Typewriter
                    key={step === 0 ? `typing-${cycle}` : 'typed'}
                    text={NUMBER}
                    play={step === 0}
                  />
                  {step === 0 && (
                    <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-accent" />
                  )}
                </p>
              </div>
              <AnimatePresence>
                {verified && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 flex items-center gap-3 rounded-[14px] border border-hairline bg-surface-1 p-3">
                      <span className="grid size-10 place-items-center rounded-full bg-surface-2 text-[0.85rem] font-bold text-ink">
                        UA
                      </span>
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 text-[0.95rem] font-bold tracking-[-0.032em] text-ink">
                          Uwase Aline <BadgeCheck className="size-4 text-success" />
                        </p>
                        <p className="text-[0.75rem] text-ink-3">
                          Registered name, checked with MTN MoMo
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="mt-5">
                <p className="text-[0.75rem] font-medium text-ink-3">They receive</p>
                <p className="mt-1 text-[2.6rem] leading-none font-bold tracking-[-0.068em] text-ink tnum">
                  <span className="text-ink-3">RWF </span>
                  <CountUp to={amountShown ? 45000 : 0} />
                </p>
              </div>
              <AnimatePresence>
                {quoteShown && (
                  <motion.dl
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    className="mt-4 divide-y divide-hairline rounded-[14px] border border-hairline bg-surface-1 text-[0.85rem]"
                  >
                    {[
                      ['Rate', '1 USD = 1,450 RWF'],
                      ['XenDirekt fee', 'RWF 875'],
                      ['Card', 'VISA •••• 4242'],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between px-4 py-2.5">
                        <dt className="text-ink-3">{label}</dt>
                        <dd className="font-medium text-ink tnum">{value}</dd>
                      </div>
                    ))}
                    <div className="flex justify-between px-4 py-2.5">
                      <dt className="font-bold text-ink">You pay</dt>
                      <dd className="font-bold text-ink tnum">USD 31.64</dd>
                    </div>
                  </motion.dl>
                )}
              </AnimatePresence>
              <div
                className={clsx(
                  'mt-4 flex h-12 items-center justify-center gap-2 rounded-[12px] text-[0.95rem] font-bold tracking-[-0.032em] transition-all duration-500',
                  quoteShown ? 'bg-accent text-on-accent' : 'bg-surface-3 text-ink-3',
                  paying && !received && 'scale-[0.985]',
                )}
              >
                {received ? 'Paid · RWF 45,000 delivered' : paying ? 'Paying…' : 'Pay USD 31.64'}
              </div>
            </div>
            {/* Live status */}
            <div className="hidden flex-col p-6 lg:flex">
              <p className="text-[0.75rem] font-medium text-ink-3">Live status</p>
              <ol className="mt-4 space-y-0">
                {[
                  ['Card authorised', 'Held, not charged yet', authorised, '0.8 s'],
                  ['Sent to MTN MoMo', 'Payout in progress', sent, '1.9 s'],
                  ['Received by Uwase', 'Your card is charged now', received, '3.4 s'],
                ].map(([title, sub, done, time], index) => (
                  <li key={title as string} className="relative flex gap-3 pb-6 last:pb-0">
                    {index < 2 && (
                      <span className="absolute top-8 left-[13px] h-[calc(100%-1.75rem)] w-0.5 bg-surface-3">
                        <motion.span
                          className="block w-full origin-top bg-accent"
                          initial={false}
                          animate={{ height: done ? '100%' : '0%' }}
                          transition={{ duration: 0.6 }}
                        />
                      </span>
                    )}
                    <motion.span
                      initial={false}
                      animate={{ scale: done ? [0.8, 1.12, 1] : 1 }}
                      className={clsx(
                        'grid size-7 shrink-0 place-items-center rounded-full border-2 transition-colors duration-300',
                        done
                          ? 'border-accent bg-accent text-on-accent'
                          : 'border-surface-3 bg-surface-2 text-ink-3',
                      )}
                    >
                      {done ? (
                        <svg viewBox="0 0 24 24" className="size-3.5">
                          <motion.path
                            d="M5 12.5l4.5 4.5L19 7.5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3.2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{ duration: 0.4 }}
                          />
                        </svg>
                      ) : (
                        <span className="size-1.5 rounded-full bg-current" />
                      )}
                    </motion.span>
                    <div className="flex-1">
                      <p
                        className={clsx(
                          'text-[0.9rem] font-bold tracking-[-0.032em]',
                          done ? 'text-ink' : 'text-ink-3',
                        )}
                      >
                        {title}
                      </p>
                      <p className="text-[0.75rem] text-ink-3">{sub}</p>
                    </div>
                    <span className="mono text-[0.68rem] text-ink-3">{done ? time : ''}</span>
                  </li>
                ))}
              </ol>
              <AnimatePresence>
                {received && (
                  <motion.div
                    initial={{ opacity: 0, y: 14, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                    className="mt-6 rounded-[14px] border border-hairline bg-surface-1 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="mono text-[0.7rem] text-ink-3">RECEIPT</span>
                      <span className="mono text-[0.7rem] text-accent-text">XD-7K2M4Q</span>
                    </div>
                    <p className="mt-2 text-[1.3rem] font-bold tracking-[-0.06em] text-ink tnum">
                      RWF 45,000
                    </p>
                    <p className="text-[0.78rem] text-ink-3">to Uwase Aline · 078* *** 456</p>
                    <div className="mt-3 flex items-center gap-2 rounded-[10px] bg-surface-2 px-3 py-2 text-[0.72rem] text-ink-2">
                      <Smartphone className="size-3.5 shrink-0" />
                      Uwase got an SMS the same second.
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="mt-auto pt-6">
                <p className="text-[0.75rem] font-medium text-ink-3">Recent</p>
                {[
                  ['Kigali Craft Market', 'RWF 18,000', 'Yesterday'],
                  ['Mama Keza', 'RWF 120,000', 'Mon'],
                ].map(([name, amount, when]) => (
                  <div
                    key={name}
                    className="flex items-center justify-between border-b border-hairline py-2.5 text-[0.8rem] last:border-0"
                  >
                    <span className="font-medium text-ink">{name}</span>
                    <span className="text-ink-3 tnum">
                      {amount} · {when}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        {/* The frame's edges light up at the corners. */}
        <div
          aria-hidden
          className="glow-edge pointer-events-none absolute inset-0 rounded-[20px]"
        />
      </motion.div>
    </div>
  );
}

/**
 * Orange glow around every side of the window, brightest at the corners: a tight halo hugging
 * the frame plus a wide, soft bloom, breathing slowly together.
 */
function FrameGlow() {
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: [0.8, 1, 0.8] }}
      transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }}
    >
      <div className="glow-bloom absolute -inset-16 rounded-[96px]" />
      <div className="glow-near absolute -inset-2 rounded-[26px]" />
    </motion.div>
  );
}

function Sidebar() {
  const items = [
    { icon: Send, label: 'Send', active: true },
    { icon: History, label: 'Activity' },
    { icon: CreditCard, label: 'Cards' },
    { icon: Bell, label: 'Inbox', badge: 2 },
    { icon: CircleHelp, label: 'Help' },
  ];
  return (
    <aside className="hidden flex-col border-r border-hairline bg-surface-1/60 p-3 md:flex">
      <div className="flex items-center justify-between px-2 py-1.5">
        <span className="flex items-center gap-2 text-[0.95rem] font-bold tracking-[-0.046em] text-ink">
          <LogoMark size={20} /> XenDirekt
        </span>
        <Search className="size-4 text-ink-3" />
      </div>
      <nav className="mt-4 space-y-0.5">
        {items.map(({ icon: Icon, label, active, badge }) => (
          <div
            key={label}
            className={clsx(
              'flex items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-[0.85rem] font-medium',
              active ? 'bg-surface-3 text-ink' : 'text-ink-2',
            )}
          >
            <Icon className={clsx('size-4', active && 'text-accent-text')} />
            {label}
            {badge && (
              <span className="ml-auto rounded-full bg-accent px-1.5 text-[0.65rem] font-bold text-on-accent">
                {badge}
              </span>
            )}
          </div>
        ))}
      </nav>
      <p className="mt-6 px-2.5 text-[0.7rem] font-medium text-ink-3">Recent recipients</p>
      {['Uwase Aline', 'Mama Keza', 'Moto Ride 456'].map((name) => (
        <div key={name} className="flex items-center gap-2 px-2.5 py-1.5 text-[0.8rem] text-ink-2">
          <span className="grid size-5 place-items-center rounded-full bg-surface-3 text-[0.55rem] font-bold">
            {name
              .split(' ')
              .map((part) => part[0])
              .join('')
              .slice(0, 2)}
          </span>
          {name}
        </div>
      ))}
      <div className="mt-auto flex items-center gap-2 rounded-[10px] border border-hairline p-2">
        <span className="grid size-7 place-items-center rounded-full bg-accent/15 text-[0.7rem] font-bold text-accent-text">
          AS
        </span>
        <div className="min-w-0 text-[0.75rem]">
          <p className="font-bold text-ink">Ana Silva</p>
          <p className="text-ink-3">Lisbon → Kigali</p>
        </div>
        <ArrowUpRight className="ml-auto size-3.5 text-ink-3" />
      </div>
    </aside>
  );
}

/** Types `text` from scratch each time it mounts with play=true (remounted per cycle via key). */
function Typewriter({ text, play }: { text: string; play: boolean }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!play) return;
    const timer = setInterval(() => setCount((c) => (c >= text.length ? c : c + 1)), 95);
    return () => clearInterval(timer);
  }, [play, text]);
  return <>{(play ? text.slice(0, count) : text) || ' '}</>;
}

function CountUp({ to }: { to: number }) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (to === 0) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 800);
      setValue(Math.round(to * (1 - Math.pow(1 - t, 4))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <>{new Intl.NumberFormat('en-US').format(to === 0 ? 0 : value)}</>;
}
