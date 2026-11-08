'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { ArrowRight, BadgeCheck, CreditCard, Info, PartyPopper, Plus, Timer } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { PinDialog } from '@/components/portal/pin-dialog';
import { CardArt } from '@/components/portal/payment-bits';
import { PageTitle } from '@/components/portal/shell';
import { Button, ButtonLink } from '@/components/ui/button';
import { ApiError, api } from '@/lib/api';
import { formatMsisdn, initials, rwf } from '@/lib/format';
import { useProfile } from '@/lib/session';
import type { Card, Payee, Payment, Quote } from '@/lib/types';

interface RecentPayee {
  payeeId: string;
  maskedIdentifier: string;
  registeredName: string;
  lastAmountRwf: number | null;
}

const PRESETS = [5_000, 10_000, 20_000, 50_000];

function SendInner() {
  const router = useRouter();
  const welcome = useSearchParams().get('welcome') === '1';
  const queryClient = useQueryClient();
  const me = useProfile();
  const cards = useQuery({
    queryKey: ['cards'],
    queryFn: () => api<{ cards: Card[] }>('v1/cards'),
  });
  const recent = useQuery({
    queryKey: ['recent-payees'],
    queryFn: () => api<{ payees: RecentPayee[] }>('v1/payees/recent'),
  });

  const [number, setNumber] = useState('');
  const [payee, setPayee] = useState<Pick<
    Payee,
    'payeeId' | 'registeredName' | 'maskedIdentifier'
  > | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [pinOpen, setPinOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // One idempotency key per quote: a retried request can never pay twice.
  const idempotencyKey = useMemo(() => (quote ? `web-${quote.quoteId}` : ''), [quote]);

  const activeCards = (cards.data?.cards ?? []).filter((card) => card.status === 'ACTIVE');
  const defaultCard = activeCards.find((c) => c.isDefault) ?? activeCards[0];
  const [chosenCardId, setCardId] = useState<string | null>(null);
  const cardId = chosenCardId ?? defaultCard?.id ?? null;
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const lookup = useMutation({
    mutationFn: (identifier: string) =>
      api<Payee>('v1/payees/lookup', {
        method: 'POST',
        body: { identifierType: 'PHONE', identifier },
      }),
    onSuccess: (result) => {
      setPayee(result);
      setError(null);
    },
    onError: (failure) =>
      setError(failure instanceof ApiError ? failure.message : 'Lookup failed.'),
  });

  const quoteMutation = useMutation({
    mutationFn: () =>
      api<Quote>('v1/quotes', {
        method: 'POST',
        body: { payeeId: payee!.payeeId, cardId, amountRwf: Number(amount) },
      }),
    onSuccess: (result) => {
      setQuote(result);
      setError(null);
    },
    onError: (failure) =>
      setError(failure instanceof ApiError ? failure.message : 'Couldn’t price this payment.'),
  });

  const digits = number.replace(/\D/g, '');
  const amountValue = Number(amount) || 0;
  const secondsLeft = quote
    ? Math.max(0, Math.floor((new Date(quote.expiresAt).getTime() - now) / 1000))
    : 0;

  function reset() {
    setQuote(null);
    setError(null);
  }

  async function pay(stepUpToken: string) {
    try {
      const payment = await api<Payment>('v1/payments', {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey, 'X-Step-Up-Token': stepUpToken },
        body: { quoteId: quote!.quoteId, note: note.trim() || undefined, returnTo: 'WEB' },
      });
      await queryClient.invalidateQueries({ queryKey: ['payments'] });
      router.push(`/app/activity/${payment.id}`);
    } catch (failure) {
      setPinOpen(false);
      if (failure instanceof ApiError && failure.code === 'QUOTE_EXPIRED') quoteMutation.mutate();
      setError(failure instanceof ApiError ? failure.message : 'The payment didn’t go through.');
    }
  }

  const firstName = me.data?.fullName?.split(' ')[0];

  return (
    <div>
      <AnimatePresence>
        {welcome && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 flex items-center gap-3 rounded-[16px] border border-accent/40 bg-accent/10 p-4 text-[0.95rem] text-ink"
          >
            <PartyPopper className="size-5 text-accent-text" /> You’re all set
            {firstName ? `, ${firstName}` : ''}. Add a card and send your first payment.
          </motion.div>
        )}
      </AnimatePresence>
      <PageTitle
        title="Send to MoMo"
        subtitle="Pay any MTN MoMo wallet in Rwanda with your own card."
      />
      <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr]">
        <div className="space-y-5">
          {/* 1. Who */}
          <section className="card p-5 sm:p-6">
            <p className="mono text-[0.72rem] tracking-[0.12em] text-ink-3">
              01 · WHO ARE YOU PAYING?
            </p>
            {payee ? (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 flex items-center gap-3 rounded-[14px] border border-hairline bg-canvas p-3.5"
              >
                <span className="grid size-11 place-items-center rounded-full bg-surface-3 text-[0.85rem] font-bold text-ink">
                  {initials(payee.registeredName)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-[1.05rem] font-bold tracking-[-0.04em] text-ink">
                    {payee.registeredName} <BadgeCheck className="size-4 shrink-0 text-success" />
                  </p>
                  <p className="text-[0.82rem] text-ink-3">
                    {payee.maskedIdentifier} · Registered MTN MoMo name
                  </p>
                </div>
                <button
                  className="text-[0.85rem] font-bold text-accent-text"
                  onClick={() => {
                    setPayee(null);
                    setNumber('');
                    reset();
                  }}
                >
                  Change
                </button>
              </motion.div>
            ) : (
              <form
                className="mt-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (digits.length >= 9) lookup.mutate(digits);
                }}
              >
                <label htmlFor="msisdn" className="text-[0.85rem] font-bold text-ink-2">
                  MTN MoMo number
                </label>
                <div className="mt-2 flex gap-2">
                  <input
                    id="msisdn"
                    inputMode="tel"
                    autoComplete="off"
                    placeholder="078 812 3456"
                    value={number}
                    onChange={(e) => setNumber(formatMsisdn(e.target.value))}
                    className="field tnum text-[1.1rem] font-bold"
                  />
                  <Button
                    type="submit"
                    size="lg"
                    className="h-[3.25rem]"
                    disabled={digits.length < 10}
                    loading={lookup.isPending}
                  >
                    Find
                  </Button>
                </div>
                <p className="mt-2 text-[0.8rem] text-ink-3">
                  We show you the registered name before you pay, so you know it’s the right person.
                </p>
                {(recent.data?.payees.length ?? 0) > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {recent.data!.payees.slice(0, 4).map((item) => (
                      <button
                        key={item.payeeId}
                        type="button"
                        onClick={() => {
                          setPayee(item);
                          if (item.lastAmountRwf) setAmount(String(item.lastAmountRwf));
                        }}
                        className="flex items-center gap-2 rounded-full border border-hairline bg-surface-2 py-1.5 pr-3 pl-1.5 text-[0.82rem] font-medium text-ink hover:border-hairline-strong"
                      >
                        <span className="grid size-6 place-items-center rounded-full bg-surface-3 text-[0.62rem] font-bold">
                          {initials(item.registeredName)}
                        </span>
                        {item.registeredName}
                      </button>
                    ))}
                  </div>
                )}
              </form>
            )}
          </section>

          {/* 2. How much */}
          <section
            className={clsx(
              'card p-5 transition-opacity sm:p-6',
              !payee && 'pointer-events-none opacity-50',
            )}
          >
            <p className="mono text-[0.72rem] tracking-[0.12em] text-ink-3">
              02 · HOW MUCH SHOULD THEY RECEIVE?
            </p>
            <div className="mt-4 flex items-baseline gap-3 border-b border-hairline pb-3">
              <span className="text-[1.6rem] font-bold tracking-[-0.06em] text-ink-3">RWF</span>
              <input
                aria-label="Amount in Rwandan francs"
                inputMode="numeric"
                placeholder="0"
                value={amount ? new Intl.NumberFormat('en-US').format(amountValue) : ''}
                onChange={(e) => {
                  setAmount(e.target.value.replace(/\D/g, '').slice(0, 9));
                  reset();
                }}
                className="w-full bg-transparent text-[3rem] leading-none font-bold tracking-[-0.07em] text-ink outline-none placeholder:text-ink-3/50 tnum"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset}
                  onClick={() => {
                    setAmount(String(preset));
                    reset();
                  }}
                  className={clsx(
                    'rounded-full border px-3 py-1.5 text-[0.82rem] font-medium tnum',
                    amountValue === preset
                      ? 'border-accent bg-accent/12 text-accent-text'
                      : 'border-hairline text-ink-2 hover:text-ink',
                  )}
                >
                  {rwf(preset)}
                </button>
              ))}
            </div>
            <label htmlFor="note" className="mt-5 block text-[0.85rem] font-bold text-ink-2">
              Note for them <span className="font-normal text-ink-3">(optional, sent by SMS)</span>
            </label>
            <input
              id="note"
              maxLength={60}
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                reset();
              }}
              placeholder="2 baskets"
              className="field mt-2"
            />
          </section>

          {/* 3. Card */}
          <section
            className={clsx(
              'card p-5 transition-opacity sm:p-6',
              !payee && 'pointer-events-none opacity-50',
            )}
          >
            <div className="flex items-center justify-between">
              <p className="mono text-[0.72rem] tracking-[0.12em] text-ink-3">03 · PAY WITH</p>
              <Link
                href="/app/cards"
                className="inline-flex items-center gap-1 text-[0.85rem] font-bold text-accent-text"
              >
                <Plus className="size-4" /> Add card
              </Link>
            </div>
            {activeCards.length === 0 ? (
              <div className="mt-4 flex items-center gap-3 rounded-[14px] border border-dashed border-hairline-strong p-4 text-[0.92rem] text-ink-2">
                <CreditCard className="size-5 text-ink-3" /> Add a Visa or Mastercard to pay.
                <ButtonLink href="/app/cards" size="sm" className="ml-auto">
                  Add a card
                </ButtonLink>
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {activeCards.map((card) => (
                  <button
                    key={card.id}
                    onClick={() => {
                      setCardId(card.id);
                      reset();
                    }}
                    className={clsx(
                      'rounded-[16px] p-1 text-left transition-shadow',
                      cardId === card.id
                        ? 'ring-2 ring-accent'
                        : 'ring-1 ring-hairline hover:ring-hairline-strong',
                    )}
                    aria-pressed={cardId === card.id}
                  >
                    <CardArt brand={card.brand} last4={card.last4} />
                    <p className="px-1 pt-1.5 text-[0.75rem] text-ink-3">
                      {card.cardCurrency ?? ''} {card.isDefault ? '· Default' : ''}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Summary */}
        <aside className="lg:sticky lg:top-8 lg:self-start">
          <div className="card overflow-hidden">
            <div className="border-b border-hairline p-6">
              <p className="text-[0.8rem] font-medium text-ink-3">
                {payee ? `${payee.registeredName} receives` : 'They receive'}
              </p>
              <p className="mt-1 text-[2.4rem] leading-none font-bold tracking-[-0.07em] text-ink tnum">
                {rwf(amountValue)}
              </p>
            </div>
            <AnimatePresence mode="wait">
              {quote ? (
                <motion.div
                  key="quote"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <dl className="divide-y divide-hairline px-6 text-[0.92rem]">
                    <div className="flex justify-between py-3">
                      <dt className="text-ink-3">Rate</dt>
                      <dd className="font-medium text-ink tnum">{quote.fxRateDisplay}</dd>
                    </div>
                    <div className="flex justify-between py-3">
                      <dt className="text-ink-3">XenDirekt fee</dt>
                      <dd className="font-medium text-ink tnum">{rwf(quote.feeRwf)}</dd>
                    </div>
                    <div className="flex justify-between py-3">
                      <dt className="text-ink-3">Card</dt>
                      <dd className="font-medium text-ink">
                        {quote.card.brand} •••• {quote.card.last4}
                      </dd>
                    </div>
                    <div className="flex justify-between py-4">
                      <dt className="text-[1.05rem] font-bold text-ink">You pay</dt>
                      <dd className="text-[1.25rem] font-bold tracking-[-0.046em] text-ink tnum">
                        {quote.totalCardDisplay}
                      </dd>
                    </div>
                  </dl>
                  <div className="space-y-3 p-6 pt-2">
                    <p
                      className={clsx(
                        'flex items-center gap-2 text-[0.82rem] tnum',
                        secondsLeft < 30 ? 'text-warning' : 'text-ink-3',
                      )}
                    >
                      <Timer className="size-4" />{' '}
                      {secondsLeft > 0
                        ? `This price is held for ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`
                        : 'This price expired.'}
                    </p>
                    {secondsLeft > 0 ? (
                      <Button size="lg" className="w-full" onClick={() => setPinOpen(true)}>
                        Pay {quote.totalCardDisplay}
                      </Button>
                    ) : (
                      <Button
                        size="lg"
                        className="w-full"
                        variant="secondary"
                        loading={quoteMutation.isPending}
                        onClick={() => quoteMutation.mutate()}
                      >
                        Get a fresh price
                      </Button>
                    )}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="review"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4 p-6"
                >
                  <p className="flex gap-2 text-[0.88rem] text-ink-2">
                    <Info className="mt-0.5 size-4 shrink-0" /> You’ll see the exact card amount,
                    fee and rate before anything is charged.
                  </p>
                  <Button
                    size="lg"
                    className="w-full"
                    disabled={!payee || amountValue < 1 || !cardId}
                    loading={quoteMutation.isPending}
                    onClick={() => quoteMutation.mutate()}
                  >
                    Review payment <ArrowRight className="size-4.5" />
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
            {error && (
              <p
                role="alert"
                className="border-t border-hairline px-6 py-4 text-[0.9rem] font-medium text-error"
              >
                {error}
              </p>
            )}
            {quote?.simulated && (
              <p className="border-t border-hairline px-6 py-3 text-[0.78rem] font-bold text-warning">
                Sandbox price: no real money moves.
              </p>
            )}
          </div>
          <p className="mt-4 px-1 text-[0.8rem] leading-relaxed text-ink-3">
            Your card is held first and only charged once {payee?.registeredName ?? 'the recipient'}{' '}
            has the money. If the payout fails, the hold is released.
          </p>
        </aside>
      </div>
      <PinDialog
        open={pinOpen}
        purpose="PAYMENT"
        title="Confirm with your PIN"
        detail={
          quote ? (
            <>
              Pay <span className="font-bold text-ink">{quote.totalCardDisplay}</span> so{' '}
              {quote.payee.registeredName} receives {rwf(quote.amountRwf)}.
            </>
          ) : null
        }
        onClose={() => setPinOpen(false)}
        onGranted={pay}
      />
    </div>
  );
}

export default function SendPage() {
  return (
    <Suspense>
      <SendInner />
    </Suspense>
  );
}
