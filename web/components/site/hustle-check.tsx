'use client';

import clsx from 'clsx';
import { ArrowLeft, ArrowRight, RotateCcw, Unlock } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { Button, ButtonLink } from '@/components/ui/button';
import { Reveal, RevealText, RevealWords } from '@/components/ui/reveal';
import { CountUp, ScrambleText } from '@/components/ui/text-effects';
import { TILE, TileGrid } from '@/components/ui/tiles';
import { ApiError, api } from '@/lib/api';
import { useLaunch } from '@/lib/launch-context';
import type { HustleResult, Persona } from '@/lib/types';
import { SectionHeading } from './section-heading';

type Key = 'persona' | 'lastTime' | 'speed' | 'fees' | 'checking';

const QUESTIONS: { key: Key; title: string; options: [string, string][] }[] = [
  {
    key: 'persona',
    title: 'First things first: who are you?',
    options: [
      ['VISITOR', 'Visiting Rwanda (or planning to)'],
      ['SENDER', 'A foreigner sending money to Rwanda'],
      ['DIASPORA', 'A Rwandan living abroad'],
      ['RECEIVER', 'In Rwanda, receiving money'],
    ],
  },
  {
    key: 'lastTime',
    title: 'Last time money had to cross into Rwanda, how did it go?',
    options: [
      ['SMOOTH', 'Smooth, honestly'],
      ['DETOUR', 'Got there, after a detour'],
      ['DECLINED', 'Card declined, plan B needed'],
      ['STUCK', 'Stuck somewhere in between'],
    ],
  },
  {
    key: 'speed',
    title: 'How long does it usually take to land?',
    options: [
      ['SECONDS', 'Seconds'],
      ['SAME_DAY', 'Same day'],
      ['DAYS', 'One to three days'],
      ['UNKNOWN', 'Depends on the moon'],
    ],
  },
  {
    key: 'fees',
    title: 'How much disappears into fees and rates?',
    options: [
      ['LOW', 'Barely anything'],
      ['SOME', 'Under 5%'],
      ['LOTS', 'More than 5%'],
      ['UNKNOWN', 'No idea, and that’s the problem'],
    ],
  },
  {
    key: 'checking',
    title: 'How often do you end up asking “did it arrive?”',
    options: [
      ['NEVER', 'Never'],
      ['SOMETIMES', 'Now and then'],
      ['OFTEN', 'Most times'],
      ['ALWAYS', 'Every. Single. Time.'],
    ],
  },
];

const TIERS: Record<HustleResult['tier'], { name: string; line: string }> = {
  SMOOTH: { name: 'Smooth operator', line: 'Lucky you. Most people we talk to aren’t this calm.' },
  PART_TIME: { name: 'Part-time hustler', line: 'It works, mostly. The detours add up.' },
  CERTIFIED: {
    name: 'Certified hustler',
    line: 'Declines, delays, double-checks. You’ve earned a break.',
  },
  LEGEND: {
    name: 'Hustle legend',
    line: 'You’ve seen it all. This is exactly why we’re building XenDirekt.',
  },
};

export function HustleCheck() {
  const { result, setResult, setPersona } = useLaunch();
  const [answers, setAnswers] = useState<Partial<Record<Key, string>>>({});
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retaking, setRetaking] = useState(false);

  const showResult = result && !retaking;
  const question = QUESTIONS[index];
  const progress = showResult ? 100 : Math.round((index / QUESTIONS.length) * 100);

  async function choose(value: string) {
    if (!question || busy) return;
    const next = { ...answers, [question.key]: value };
    setAnswers(next);
    if (question.key === 'persona') setPersona(value as Persona);
    if (index < QUESTIONS.length - 1) {
      setDirection(1);
      setIndex(index + 1);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const scored = await api<HustleResult>('v1/launch/hustle-check', {
        method: 'POST',
        body: next,
      });
      setResult(scored);
      setRetaking(false);
    } catch (failure) {
      setError(
        failure instanceof ApiError ? failure.message : 'We couldn’t score that. Try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  function restart() {
    setAnswers({});
    setIndex(0);
    setRetaking(true);
  }

  return (
    <section id="check" className="scroll-mt-20 border-t border-hairline py-24 sm:py-32">
      <div className="container-x">
        <SectionHeading eyebrow="The Hustle Check" title="How much of a hustle [is it for you?]" />
        <TileGrid className="mt-12">
          <Reveal className={clsx(TILE, 'overflow-hidden bg-tile p-6 sm:p-10')}>
            <div className="mono flex items-center justify-between text-[0.75rem] text-ink-2">
              <span>
                {showResult ? 'Your result' : `Question ${index + 1} of ${QUESTIONS.length}`}
              </span>
              <span className="tnum">{progress}% done</span>
            </div>
            <div className="mt-3 h-[3px] overflow-hidden bg-surface-3">
              <motion.div
                className="h-full bg-accent"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <div className="relative mt-9 min-h-[300px]">
              <AnimatePresence mode="wait" custom={direction} initial={false}>
                {showResult && result ? (
                  <Result key="result" result={result} onRestart={restart} />
                ) : question ? (
                  <motion.div
                    key={question.key}
                    custom={direction}
                    initial={{ opacity: 0, x: 40 * direction, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, x: -40 * direction, filter: 'blur(4px)' }}
                    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <RevealWords
                      as="h3"
                      trigger="mount"
                      stagger={0.05}
                      text={question.title}
                      className="text-[clamp(1.6rem,3vw,2.4rem)] leading-[1.1] font-bold tracking-[-0.066em] text-ink"
                    />
                    <TileGrid marks={false} className="mt-7 sm:grid-cols-2 lg:grid-cols-4">
                      {question.options.map(([value, label], optionIndex) => (
                        <motion.button
                          key={value}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.05 * optionIndex }}
                          onClick={() => choose(value)}
                          disabled={busy}
                          className={clsx(
                            TILE,
                            'group flex min-h-[104px] items-center justify-between gap-3 p-6 text-left text-[1.02rem] leading-snug font-medium tracking-[-0.032em] text-ink transition-colors duration-200',
                            answers[question.key] === value
                              ? 'bg-accent/10 shadow-[inset_0_0_0_1px_#FF640A]'
                              : 'hover:bg-tile-hover hover:shadow-[inset_0_-2px_0_#FF640A]',
                          )}
                        >
                          {label}
                          <ArrowRight className="size-4.5 shrink-0 text-accent-text transition-transform group-hover:translate-x-1" />
                        </motion.button>
                      ))}
                    </TileGrid>
                    <div className="mt-6 flex items-center justify-between text-[0.85rem] text-ink-3">
                      <span>Anonymous. We only use answers to understand the problem.</span>
                      {index > 0 && (
                        <button
                          className="inline-flex items-center gap-1.5 font-medium text-ink-2 hover:text-ink"
                          onClick={() => {
                            setDirection(-1);
                            setIndex(index - 1);
                          }}
                        >
                          <ArrowLeft className="size-4" /> Back
                        </button>
                      )}
                    </div>
                    {busy && (
                      <p className="mt-4 text-[0.9rem] font-medium text-ink-2">
                        Scoring your hustle…
                      </p>
                    )}
                    {error && (
                      <p role="alert" className="mt-4 text-[0.9rem] font-medium text-error">
                        {error}
                      </p>
                    )}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </Reveal>
        </TileGrid>
      </div>
    </section>
  );
}

function Result({ result, onRestart }: { result: HustleResult; onRestart: () => void }) {
  const tier = TIERS[result.tier];
  const circumference = 2 * Math.PI * 52;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="grid gap-10 lg:grid-cols-[auto_1fr] lg:items-center"
      role="status"
    >
      <div className="relative mx-auto size-[180px]">
        <svg viewBox="0 0 120 120" className="size-full -rotate-90">
          <circle cx="60" cy="60" r="52" fill="none" stroke="var(--xd-surface-3)" strokeWidth="9" />
          <motion.circle
            cx="60"
            cy="60"
            r="52"
            fill="none"
            stroke="#FF640A"
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference * (1 - result.score / 100) }}
            transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-[3rem] leading-none font-bold tracking-[-0.07em] text-ink tnum">
              <CountUp trigger="mount" to={result.score} duration={1400} />
            </p>
            <p className="mono mt-1 text-[0.65rem] text-ink-3">HUSTLE SCORE</p>
          </div>
        </div>
      </div>
      <div>
        <ScrambleText as="p" trigger="mount" text={tier.name} className="eyebrow" />
        <RevealWords
          as="h3"
          trigger="mount"
          delay={0.2}
          stagger={0.05}
          text={
            result.percentile === null
              ? 'You’re the first to take the check. Trailblazer.'
              : `More hustled than ${result.percentile}% of people who took the check.`
          }
          className="mt-3 text-[clamp(1.6rem,3vw,2.4rem)] leading-[1.1] font-bold tracking-[-0.066em] text-ink"
        />
        <RevealText
          trigger="mount"
          delay={0.7}
          text={tier.line}
          className="mt-3 max-w-[42rem] text-[1.05rem] text-ink-2"
        />
        {result.insights && (
          <TileGrid marks={false} className="mt-6 sm:grid-cols-3">
            {[
              [result.insights.hitAWallPct, 'hit a declined card or a stuck transfer'],
              [result.insights.unknownFeesPct, 'have no idea what fees really cost them'],
              [result.insights.alwaysCheckingPct, 'end up asking “did it arrive?”'],
            ].map(([pct, label]) => (
              <div key={label as string} className={clsx(TILE, 'p-5')}>
                <p className="text-[1.8rem] leading-none font-bold tracking-[-0.072em] text-ink tnum">
                  {pct}%
                </p>
                <p className="mt-1.5 text-[0.85rem] text-ink-2">{label}</p>
              </div>
            ))}
          </TileGrid>
        )}
        <p className="mt-6 inline-flex items-center gap-2 bg-accent/12 px-3 py-1.5 text-[0.85rem] font-medium text-accent-text">
          <Unlock className="size-4" /> The classified files are now open.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href="/#join" size="lg" shape="sharp" roll>
            Get early access <ArrowRight className="size-4.5" />
          </ButtonLink>
          <ButtonLink href="/#files" size="lg" variant="secondary" shape="sharp" roll>
            See the files
          </ButtonLink>
          <Button size="lg" variant="ghost" shape="sharp" onClick={onRestart}>
            <RotateCcw className="size-4" /> Retake
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
