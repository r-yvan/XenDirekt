'use client';

import clsx from 'clsx';
import {
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from 'motion/react';
import { useEffect, useRef, useState } from 'react';

const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+=/<>';
const LOWER = 'abcdefghijklmnopqrstuvwxyz0123456789#%&*+=/<>';
const KEEP = /[\s·.,:;!?'’—\-()]/;

/**
 * "Declassified" decode: letters cycle through random glyphs and settle left to right. Meant for
 * monospaced labels, so the width never jumps. Reduced motion shows the text as is.
 */
export function ScrambleText({
  text,
  className,
  trigger = 'view',
  delay = 0,
  duration = 900,
  as: Tag = 'span',
}: {
  text: string;
  className?: string;
  trigger?: 'view' | 'mount';
  delay?: number;
  duration?: number;
  as?: 'span' | 'p';
}) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -8% 0px' });
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(text);
  const active = trigger === 'mount' || inView;

  useEffect(() => {
    if (!active || reduced) return;
    let raf = 0;
    let frame = 0;
    const start = performance.now() + delay * 1000;
    const tick = (now: number) => {
      frame += 1;
      const elapsed = Math.max(0, now - start);
      const settled = Math.floor((elapsed / duration) * text.length);
      if (settled >= text.length) {
        setDisplay(text);
        return;
      }
      // New random glyphs every other frame: lively without strobing.
      if (frame % 2 === 0) {
        let next = '';
        for (let index = 0; index < text.length; index += 1) {
          const char = text.charAt(index);
          if (index < settled || KEEP.test(char)) {
            next += char;
          } else {
            const pool = char === char.toLowerCase() ? LOWER : UPPER;
            next += pool.charAt(Math.floor(Math.random() * pool.length));
          }
        }
        setDisplay(next);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, reduced, text, delay, duration]);

  return (
    <Tag ref={ref as React.Ref<HTMLParagraphElement>} className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden>{display}</span>
    </Tag>
  );
}

/** A statement that lights up word by word as it scrolls through the viewport. */
export function ScrollWords({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.9', 'end 0.5'] });
  const words = text.split(' ');
  return (
    <p ref={ref} className={className}>
      <span className="sr-only">{text}</span>
      {words.map((word, index) => (
        <ScrollWord
          key={`${word}-${index}`}
          progress={scrollYProgress}
          range={[index / words.length, (index + 1) / words.length]}
        >
          {word}
          {index < words.length - 1 ? ' ' : ''}
        </ScrollWord>
      ))}
    </p>
  );
}

function ScrollWord({
  progress,
  range,
  children,
}: {
  progress: MotionValue<number>;
  range: [number, number];
  children: React.ReactNode;
}) {
  const opacity = useTransform(progress, range, [0.16, 1]);
  const y = useTransform(progress, range, [6, 0]);
  return (
    <motion.span aria-hidden style={{ opacity, y }} className="inline-block">
      {children}
    </motion.span>
  );
}

/**
 * Label that rolls up on hover, replaced by a copy rising from below. The hovered ancestor needs
 * the `group/roll` class.
 */
export function RollText({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const move = 'transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]';
  return (
    <span className={clsx('relative inline-flex overflow-hidden', className)}>
      <span
        className={clsx(
          'inline-flex items-center gap-2',
          move,
          'group-hover/roll:-translate-y-[125%]',
        )}
      >
        {children}
      </span>
      <span
        aria-hidden
        className={clsx(
          'absolute inset-0 inline-flex items-center justify-center gap-2 translate-y-[125%]',
          move,
          'group-hover/roll:translate-y-0',
        )}
      >
        {children}
      </span>
    </span>
  );
}

/** Counts up to `to` once it scrolls into view (or straight away with `trigger="mount"`). */
export function CountUp({
  to,
  duration = 1100,
  trigger = 'view',
  format = (value: number) => new Intl.NumberFormat('en-US').format(value),
}: {
  to: number;
  duration?: number;
  trigger?: 'view' | 'mount';
  format?: (value: number) => string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduced = useReducedMotion();
  const [value, setValue] = useState(0);
  const active = trigger === 'mount' || inView;

  useEffect(() => {
    if (!active || reduced) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setValue(Math.round(to * (1 - Math.pow(1 - t, 4))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, reduced, to, duration]);

  return <span ref={ref}>{format(reduced ? to : value)}</span>;
}
