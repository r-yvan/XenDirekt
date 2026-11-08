'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Check, LifeBuoy, ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';
import Link from 'next/link';
import { use, useState } from 'react';
import { Receipt, StatusPill, StatusTracker } from '@/components/portal/payment-bits';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { ApiError, api } from '@/lib/api';
import { dateTime, rwf } from '@/lib/format';
import type { Payment, Ticket } from '@/lib/types';

const FINAL = new Set(['COMPLETED', 'FAILED', 'REFUNDED']);
const CATEGORIES = [
  ['SELLER_NOT_PAID', 'They didn’t receive the money'],
  ['WRONG_AMOUNT', 'Wrong amount'],
  ['CHARGED_BUT_FAILED', 'Charged but it failed'],
  ['CHARGED_TWICE', 'Charged twice'],
  ['WRONG_SELLER', 'Paid the wrong person'],
  ['OTHER', 'Something else'],
] as const;

export default function PaymentDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const payment = useQuery({
    queryKey: ['payment', id],
    queryFn: () => api<Payment>(`v1/payments/${id}`),
    // Poll while the payment is still moving (the API's documented contract).
    refetchInterval: (query) =>
      query.state.data && FINAL.has(query.state.data.status) ? false : 1500,
  });
  const [category, setCategory] = useState<string>('SELLER_NOT_PAID');
  const [message, setMessage] = useState('');
  const [reporting, setReporting] = useState(false);
  const report = useMutation({
    mutationFn: () =>
      api<Ticket>(`v1/payments/${id}/tickets`, {
        method: 'POST',
        body: { category, message: message.trim() || undefined },
      }),
  });

  if (payment.isLoading) return <Spinner className="size-6 text-ink-3" />;
  if (!payment.data)
    return (
      <p className="text-ink-2">
        We couldn’t find this payment.{' '}
        <Link href="/app/activity" className="font-bold text-accent-text">
          Back to activity
        </Link>
      </p>
    );
  const p = payment.data;
  const done = p.status === 'COMPLETED';

  return (
    <div>
      <Link
        href="/app/activity"
        className="mb-6 inline-flex items-center gap-1.5 text-[0.9rem] font-medium text-ink-2 hover:text-ink"
      >
        <ArrowLeft className="size-4" /> Activity
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mono text-[0.75rem] text-ink-3">
            {p.reference} · {dateTime(p.createdAt)}
          </p>
          <h1 className="mt-1 text-[2.4rem] leading-none font-bold tracking-[-0.068em] text-ink tnum">
            {rwf(p.amountRwf)}
          </h1>
          <p className="mt-2 text-ink-2">
            to <span className="font-bold text-ink">{p.payee.registeredName}</span> ·{' '}
            {p.payee.maskedIdentifier}
          </p>
        </div>
        <StatusPill status={p.status} />
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-6">
          {p.nextAction?.type === 'THREE_DS' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="card border-accent/50 p-6"
            >
              <span className="grid size-11 place-items-center rounded-full bg-accent/14 text-accent-text">
                <ShieldAlert className="size-5" />
              </span>
              <p className="title mt-4 text-ink">Your bank wants to confirm this payment</p>
              <p className="mt-1 text-ink-2">
                You’ll go to your bank’s secure page and come straight back here. Nothing is charged
                until the payment completes.
              </p>
              <Button
                size="lg"
                className="mt-5 w-full"
                onClick={() => {
                  window.location.href = p.nextAction!.url;
                }}
              >
                Continue to your bank
              </Button>
            </motion.div>
          )}
          <div className="card p-6">
            <p className="mb-5 text-[0.8rem] font-bold text-ink-3">LIVE STATUS</p>
            <StatusTracker payment={p} />
            {p.failureReason && (
              <p className="mt-5 rounded-[12px] bg-error/10 p-3 text-[0.9rem] text-error">
                {p.chargeStatus === 'NOT_CHARGED' || p.chargeStatus === 'RELEASED'
                  ? 'You were not charged. '
                  : ''}
                {p.failureReason.replace(/_/g, ' ').toLowerCase()}
              </p>
            )}
            {p.status === 'IN_REVIEW' && (
              <p className="mt-5 rounded-[12px] bg-warning/10 p-3 text-[0.9rem] text-warning">
                We’re checking this payment. You’ll get a notification as soon as it’s resolved.
              </p>
            )}
          </div>
          <div className="card p-6">
            {report.isSuccess ? (
              <p className="flex items-start gap-3 text-ink">
                <Check className="mt-0.5 size-5 text-success" /> Thanks. Ticket{' '}
                <span className="mono font-bold">{report.data.reference}</span> is open; we’ll reply
                by email.
              </p>
            ) : reporting ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  report.mutate();
                }}
                className="space-y-3"
              >
                <p className="font-bold tracking-[-0.032em] text-ink">What went wrong?</p>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="field"
                >
                  {CATEGORIES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={1000}
                  rows={3}
                  placeholder="Anything that helps us (optional)"
                  className="field h-auto py-3"
                />
                {report.isError && (
                  <p className="text-[0.9rem] text-error">
                    {report.error instanceof ApiError ? report.error.message : 'Couldn’t send.'}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button type="submit" loading={report.isPending}>
                    Send report
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setReporting(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setReporting(true)}
                className="flex w-full items-center gap-3 text-left"
              >
                <LifeBuoy className="size-5 text-ink-3" />
                <span className="flex-1">
                  <span className="block font-bold tracking-[-0.032em] text-ink">
                    Report a problem
                  </span>
                  <span className="text-[0.85rem] text-ink-3">
                    We’ll look into this payment with you.
                  </span>
                </span>
              </button>
            )}
          </div>
        </div>
        <div>
          {done ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            >
              <Receipt payment={p} />
            </motion.div>
          ) : (
            <div className="card p-6">
              <p className="text-[0.8rem] font-bold text-ink-3">SUMMARY</p>
              <dl className="mt-3 divide-y divide-hairline text-[0.92rem]">
                {[
                  ['They receive', rwf(p.amountRwf)],
                  ['XenDirekt fee', rwf(p.feeRwf)],
                  ['Rate', p.fxRateDisplay],
                  ['Card', `${p.card.brand} •••• ${p.card.last4}`],
                  ['You pay', p.totalCardDisplay],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between py-3">
                    <dt className="text-ink-3">{k}</dt>
                    <dd className="font-medium text-ink tnum">{v}</dd>
                  </div>
                ))}
              </dl>
              {p.note && (
                <p className="mt-3 rounded-[10px] bg-surface-2 px-3 py-2 text-[0.85rem] text-ink-2">
                  Note: {p.note}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
