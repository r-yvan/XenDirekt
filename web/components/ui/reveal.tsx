'use client';

import { motion, type HTMLMotionProps, type Variants } from 'motion/react';

const EASE = [0.22, 1, 0.36, 1] as const;
const NBSP = ' ';

type Trigger = 'view' | 'mount';

const TAGS = {
  h1: motion.h1,
  h2: motion.h2,
  h3: motion.h3,
  p: motion.p,
  span: motion.span,
  div: motion.div,
};

/**
 * The parent element decides when to play (on mount, or once it scrolls into view) and the
 * words follow through variants. Observing the parent matters: each word starts hidden below
 * its mask, where an intersection observer on the word itself would never fire.
 */
function playProps(trigger: Trigger) {
  return trigger === 'mount'
    ? { initial: 'hidden', animate: 'shown' }
    : {
        initial: 'hidden',
        whileInView: 'shown',
        viewport: { once: true, margin: '0px 0px -8% 0px' },
      };
}

/** Fades, lifts and un-blurs a block as it scrolls into view (once). */
export function Reveal({
  delay = 0,
  y = 30,
  children,
  ...rest
}: { delay?: number; y?: number } & HTMLMotionProps<'div'>) {
  return (
    <motion.div
      initial={{ opacity: 0, y, filter: 'blur(10px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '0px 0px -10% 0px' }}
      transition={{ duration: 1, delay, ease: EASE }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

const flipUp: Variants = {
  hidden: { y: '118%', rotateX: -75, opacity: 0, filter: 'blur(14px)' },
  shown: (delay: number) => ({
    y: '0%',
    rotateX: 0,
    opacity: 1,
    filter: 'blur(0px)',
    transition: { duration: 1.2, delay, ease: EASE },
  }),
};

/**
 * Splits a headline into words. Words inside [brackets] are muted (grey), for two-tone
 * headlines: "[Paying in Rwanda] shouldn’t be a hustle."
 */
function parseWords(text: string): { plain: string; words: { word: string; muted: boolean }[] } {
  let muted = false;
  const words = text.split(' ').map((token) => {
    let word = token;
    if (word.startsWith('[')) {
      muted = true;
      word = word.slice(1);
    }
    const current = muted;
    if (word.endsWith(']')) {
      word = word.slice(0, -1);
      muted = false;
    }
    return { word, muted: current };
  });
  return { plain: text.replace(/[[\]]/g, ''), words };
}

/**
 * Headline reveal: each word flips up out of a mask and un-blurs as it lands. Whole words are
 * animated (not letters) so the font's kerning survives the tight tracking.
 */
export function RevealWords({
  text,
  className,
  delay = 0,
  stagger = 0.075,
  trigger = 'view',
  as = 'h2',
}: {
  text: string;
  className?: string;
  delay?: number;
  stagger?: number;
  trigger?: Trigger;
  as?: 'h1' | 'h2' | 'h3';
}) {
  const Tag = TAGS[as];
  const { plain, words } = parseWords(text);
  return (
    <Tag className={className} {...playProps(trigger)}>
      <span className="sr-only">{plain}</span>
      {words.map(({ word, muted }, index) => (
        <span
          key={`${word}-${index}`}
          aria-hidden
          className="-mx-[0.08em] -mt-[0.1em] -mb-[0.16em] inline-block overflow-hidden px-[0.08em] pt-[0.1em] pb-[0.16em] align-bottom [perspective:700px]"
        >
          <motion.span
            className={
              muted ? 'inline-block origin-bottom text-ink-3' : 'inline-block origin-bottom'
            }
            variants={flipUp}
            custom={delay + index * stagger}
          >
            {word}
            {index < words.length - 1 ? NBSP : ''}
          </motion.span>
        </span>
      ))}
    </Tag>
  );
}

const driftIn: Variants = {
  hidden: { opacity: 0, y: '0.5em', filter: 'blur(9px)' },
  shown: (delay: number) => ({
    opacity: 1,
    y: '0em',
    filter: 'blur(0px)',
    transition: { duration: 0.85, delay, ease: EASE },
  }),
};

/** Paragraph reveal: words drift up and un-blur one after another. */
export function RevealText({
  text,
  className,
  delay = 0,
  stagger = 0.022,
  trigger = 'view',
  as = 'p',
}: {
  text: string;
  className?: string;
  delay?: number;
  stagger?: number;
  trigger?: Trigger;
  as?: 'p' | 'span' | 'div';
}) {
  const Tag = TAGS[as];
  const words = text.split(' ');
  return (
    <Tag className={className} {...playProps(trigger)}>
      <span className="sr-only">{text}</span>
      {words.map((word, index) => (
        <motion.span
          key={`${word}-${index}`}
          aria-hidden
          className="inline-block"
          variants={driftIn}
          custom={delay + index * stagger}
        >
          {word}
          {index < words.length - 1 ? NBSP : ''}
        </motion.span>
      ))}
    </Tag>
  );
}
