'use client';

import clsx from 'clsx';
import { Check, X } from 'lucide-react';
import { motion } from 'motion/react';
import { rwf } from '@/lib/format';
import { BankCard } from '@/components/ui/bank-card';
import type { Payment } from '@/lib/types';

const STATUS: Record<string, { label: string; tone: string }> = {
  COMPLETED: { label: 'Completed', tone: 'text-success bg-success/12' },
  PROCESSING: { label: 'In progress', tone: 'text-info bg-info/12' },
  ACTION_REQUIRED: { label: 'Needs your bank', tone: 'text-warning bg-warning/12' },
  FAILED: { label: 'Not completed', tone: 'text-error bg-error/12' },
  IN_REVIEW: { label: 'In review', tone: 'text-warning bg-warning/12' },
  REFUNDED: { label: 'Refunded', tone: 'text-ink-2 bg-surface-3' },
};

export function StatusPill({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, tone: 'text-ink-2 bg-surface-3' };
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.75rem] font-bold',
        s.tone,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {s.label}
    </span>
  );
}

/** Processing → Sent → Received, as the mobile app shows it (FR-EXE-04). */
export function StatusTracker({ payment }: { payment: Payment }) {
  const failed = payment.status === 'FAILED';
  const steps = [
    ['Processing', 'Card held, not charged yet', payment.steps.processing],
    ['Sent', 'Payout to MTN MoMo', payment.steps.sent],
    ['Received', `${payment.payee.registeredName} has it`, payment.steps.received],
  ] as const;
  const activeIndex = steps.findIndex(([, , done]) => !done);
  return (
    <ol className="space-y-0">
      {steps.map(([title, sub, done], index) => {
        const active = index === activeIndex && !failed;
        const isFailed = failed && index === activeIndex;
        return (
          <li key={title} className="relative flex gap-4 pb-7 last:pb-0">
            {index < steps.length - 1 && (
              <span className="absolute top-9 left-[17px] h-[calc(100%-2.25rem)] w-0.5 overflow-hidden rounded bg-surface-3">
                <motion.span
                  className="block w-full bg-accent"
                  initial={false}
                  animate={{ height: steps[index + 1]?.[2] ? '100%' : done ? '50%' : '0%' }}
                  transition={{ duration: 0.7 }}
                />
              </span>
            )}
            <motion.span
              initial={false}
              animate={{ scale: done ? [0.85, 1.12, 1] : 1 }}
              className={clsx(
                'relative grid size-9 shrink-0 place-items-center rounded-full border-2',
                isFailed
                  ? 'border-error bg-error text-white'
                  : done
                    ? 'border-accent bg-accent text-on-accent'
                    : active
                      ? 'border-accent bg-surface-2'
                      : 'border-surface-3 bg-surface-2 text-ink-3',
              )}
            >
              {isFailed ? (
                <X className="size-4" strokeWidth={3} />
              ) : done ? (
                <Check className="size-4" strokeWidth={3} />
              ) : active ? (
                <span className="size-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              ) : (
                <span className="size-1.5 rounded-full bg-current" />
              )}
            </motion.span>
            <div className="pt-1">
              <p
                className={clsx(
                  'text-[1rem] font-bold tracking-[-0.04em]',
                  done || active ? 'text-ink' : 'text-ink-3',
                )}
              >
                {title}
              </p>
              <p className="text-[0.85rem] text-ink-3">{sub}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function Receipt({ payment }: { payment: Payment }) {
  const r = payment.receipt;
  if (!r) return null;
  const rows: [string, string][] = [
    ['Paid to', `${r.merchantName} · ${r.merchantIdentifier}`],
    ['They received', rwf(r.amountRwf)],
    ['XenDirekt fee', rwf(r.feeRwf)],
    ['Rate', r.fxRateDisplay],
    ['Card charged', `${r.totalCardDisplay} · ${r.card}`],
    [
      'Date (Kigali)',
      new Date(r.kigaliDateTime).toLocaleString('en-GB', {
        timeZone: 'Africa/Kigali',
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    ],
  ];
  return (
    <div className="relative overflow-hidden rounded-[20px] border border-hairline bg-surface-1">
      <div className="flex items-center justify-between border-b border-dashed border-hairline-strong p-5">
        <div>
          <p className="mono text-[0.7rem] tracking-[0.14em] text-ink-3">RECEIPT</p>
          <p className="mt-1 text-[1.6rem] font-bold tracking-[-0.072em] text-ink tnum">
            {rwf(r.amountRwf)}
          </p>
        </div>
        <span className="mono rounded-md bg-accent/12 px-2 py-1 text-[0.8rem] font-bold text-accent-text">
          {r.reference}
        </span>
      </div>
      <dl className="divide-y divide-hairline px-5">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 py-3 text-[0.9rem]">
            <dt className="text-ink-3">{k}</dt>
            <dd className="text-right font-medium text-ink tnum">{v}</dd>
          </div>
        ))}
      </dl>
      {r.simulated && (
        <p className="border-t border-hairline px-5 py-3 text-[0.78rem] font-bold text-warning">
          Sandbox receipt: no real money moved.
        </p>
      )}
    </div>
  );
}

export function CardArt({
  brand,
  last4,
  className,
}: {
  brand: string;
  last4: string;
  className?: string;
}) {
  return <BankCard brand={brand} last4={last4} className={className} />;
}
