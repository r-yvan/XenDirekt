'use client';

import clsx from 'clsx';
import { ArrowRight, Check, Copy, Mail, MessageCircle, Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { useEffect, useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ApiError, api } from '@/lib/api';
import { compactNumber } from '@/lib/format';
import { PERSONA_LABELS, useLaunch } from '@/lib/launch-context';
import type { Persona, WaitlistStatus } from '@/lib/types';

const PERSONA_SHORT: Record<Persona, string> = {
  VISITOR: 'Visiting',
  SENDER: 'Sending from abroad',
  DIASPORA: 'Rwandan abroad',
  RECEIVER: 'Receiving in Rwanda',
};

/**
 * Join the waitlist: email first (one field, one tap), then optional "who are you" chips.
 * Joining is idempotent server-side; a repeat shows the existing spot.
 */
export function WaitlistForm({ source, size = 'lg' }: { source: string; size?: 'md' | 'lg' }) {
  const { joined, setJoined, persona, setPersona, referralCode } = useLaunch();
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = useId();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
      setError('Enter a valid email address.');
      return;
    }
    if (!consent) {
      setError('Please accept the privacy notice so we can email you.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const status = await api<WaitlistStatus>('v1/launch/waitlist', {
        method: 'POST',
        body: {
          email: value,
          persona: persona ?? undefined,
          referralCode: referralCode ?? undefined,
          source,
          acceptPrivacy: true,
        },
      });
      setJoined(status);
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full">
      <AnimatePresence mode="wait" initial={false}>
        {joined ? (
          <motion.div
            key="joined"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <JoinedCard status={joined} />
          </motion.div>
        ) : (
          <motion.form
            key="form"
            onSubmit={submit}
            exit={{ opacity: 0, y: -8 }}
            noValidate
            className="w-full"
          >
            <div
              className={clsx(
                'flex w-full flex-col gap-2 rounded-[18px] border border-hairline-strong bg-surface-1/80 p-1.5 backdrop-blur-md transition-shadow focus-within:border-accent focus-within:shadow-[0_0_0_4px_rgb(255_100_10/0.14)] sm:flex-row',
              )}
            >
              <label htmlFor={`${id}-email`} className="sr-only">
                Email address
              </label>
              <div className="flex flex-1 items-center gap-2.5 px-3">
                <Mail className="size-4.5 shrink-0 text-ink-3" />
                <input
                  id={`${id}-email`}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className={clsx(
                    'w-full bg-transparent text-ink outline-none placeholder:text-ink-3',
                    size === 'lg' ? 'h-12 text-[1.05rem]' : 'h-10 text-[0.95rem]',
                  )}
                />
              </div>
              <Button
                type="submit"
                size={size === 'lg' ? 'lg' : 'md'}
                loading={busy}
                roll
                className={size === 'lg' ? 'sm:h-12' : undefined}
              >
                Join the waitlist
                <ArrowRight className="size-4.5" />
              </Button>
            </div>
            <div
              className="mt-3 flex flex-wrap items-center gap-1.5"
              role="group"
              aria-label="I am"
            >
              {(Object.keys(PERSONA_SHORT) as Persona[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  title={PERSONA_LABELS[value]}
                  aria-pressed={persona === value}
                  onClick={() => setPersona(value)}
                  className={clsx(
                    'rounded-full border font-medium transition-colors',
                    size === 'lg' ? 'px-3 py-1.5 text-[0.8rem]' : 'px-2.5 py-1 text-[0.74rem]',
                    persona === value
                      ? 'border-accent bg-accent/12 text-accent-text'
                      : 'border-hairline text-ink-2 hover:border-hairline-strong hover:text-ink',
                  )}
                >
                  {PERSONA_SHORT[value]}
                </button>
              ))}
            </div>
            <label
              className={clsx(
                'mt-3 flex cursor-pointer items-start gap-2.5 leading-snug text-ink-3',
                size === 'lg' ? 'text-[0.82rem]' : 'text-[0.74rem]',
              )}
            >
              <input
                type="checkbox"
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-[#FF640A]"
              />
              <span>
                Email me about early access. We only use your email for the launch, and you can
                leave any time.{' '}
                <Link
                  href="/privacy"
                  className="text-accent-text underline-offset-2 hover:underline"
                >
                  Privacy notice
                </Link>
              </span>
            </label>
            {referralCode && (
              <p className="mono mt-2 text-[0.72rem] text-ink-3">
                Invited with code {referralCode}
              </p>
            )}
            <AnimatePresence>
              {error && (
                <motion.p
                  role="alert"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-2 text-[0.88rem] font-medium text-error"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}

export function JoinedCard({ status }: { status: WaitlistStatus }) {
  const [copied, setCopied] = useState(false);
  const [shown, setShown] = useState(0);

  // The spot counts up to its number: a small moment of delight.
  useEffect(() => {
    const target = status.position;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 900);
      setShown(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [status.position]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(status.shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked: the link is visible to copy by hand */
    }
  }

  const message = encodeURIComponent(
    `Paying into Rwanda shouldn't be a hustle. I'm on the XenDirekt waitlist, join me: ${status.shareUrl}`,
  );

  return (
    <div className="card relative overflow-hidden p-5 sm:p-6" role="status">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow flex items-center gap-2">
            <Sparkles className="size-3.5" />
            {status.alreadyJoined ? 'You were already on the list' : 'You’re on the list'}
          </p>
          <p className="mt-3 text-[3.4rem] leading-none font-bold tracking-[-0.07em] text-ink tnum">
            #{compactNumber(shown)}
          </p>
          <p className="mt-2 text-[0.95rem] text-ink-2">
            {status.referrals > 0
              ? `${status.referrals} friend${status.referrals === 1 ? '' : 's'} joined with your link.`
              : `Every friend who joins with your link moves you up ${status.referralBoost} places.`}
          </p>
        </div>
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-on-accent">
          <Check className="size-5" strokeWidth={3} />
        </span>
      </div>
      <div className="mt-5 flex items-center gap-2 rounded-[12px] border border-hairline bg-surface-2 p-1.5 pl-3">
        <span className="mono truncate text-[0.8rem] text-ink-2">
          {status.shareUrl.replace(/^https?:\/\//, '')}
        </span>
        <Button size="sm" variant="secondary" onClick={copy} className="ml-auto shrink-0">
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? 'Copied' : 'Copy link'}
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          className="inline-flex items-center gap-1.5 rounded-full border border-hairline px-3 py-1.5 text-[0.82rem] font-medium text-ink-2 hover:text-ink"
          href={`https://wa.me/?text=${message}`}
          target="_blank"
          rel="noreferrer"
        >
          <MessageCircle className="size-3.5" /> WhatsApp
        </a>
        <a
          className="inline-flex items-center gap-1.5 rounded-full border border-hairline px-3 py-1.5 text-[0.82rem] font-medium text-ink-2 hover:text-ink"
          href={`mailto:?subject=${encodeURIComponent('Join me on the XenDirekt waitlist')}&body=${message}`}
        >
          <Mail className="size-3.5" /> Email
        </a>
        <Link
          className="inline-flex items-center gap-1.5 rounded-full border border-hairline px-3 py-1.5 text-[0.82rem] font-medium text-ink-2 hover:text-ink"
          href={`/waitlist/${status.referralCode}`}
        >
          Track your spot <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}
