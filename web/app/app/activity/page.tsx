'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { ChevronRight, Send } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { StatusPill } from '@/components/portal/payment-bits';
import { PageTitle } from '@/components/portal/shell';
import { Button, ButtonLink } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { api } from '@/lib/api';
import { initials, relativeDay, rwf } from '@/lib/format';
import type { Payment } from '@/lib/types';

const FILTERS = [
  ['ALL', 'All'],
  ['COMPLETED', 'Completed'],
  ['IN_PROGRESS', 'In progress'],
  ['FAILED', 'Not completed'],
  ['IN_REVIEW', 'In review'],
  ['REFUNDED', 'Refunded'],
] as const;

export default function ActivityPage() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>('ALL');
  const payments = useInfiniteQuery({
    queryKey: ['payments', filter],
    initialPageParam: '',
    queryFn: ({ pageParam }) =>
      api<{ payments: Payment[]; nextCursor: string | null }>(
        `v1/payments?status=${filter}&limit=20${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''}`,
      ),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    refetchInterval: 15_000,
  });
  const items = payments.data?.pages.flatMap((page) => page.payments) ?? [];
  const groups = items.reduce<Record<string, Payment[]>>((acc, payment) => {
    const day = relativeDay(payment.createdAt);
    (acc[day] ??= []).push(payment);
    return acc;
  }, {});

  return (
    <div>
      <PageTitle title="Activity" subtitle="Every payment, its status and its receipt." />
      <div className="-mx-1 mb-6 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {FILTERS.map(([value, label]) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={clsx(
              'shrink-0 rounded-full border px-3.5 py-1.5 text-[0.85rem] font-medium',
              filter === value
                ? 'border-ink bg-ink text-canvas'
                : 'border-hairline text-ink-2 hover:text-ink',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {payments.isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[72px] animate-pulse rounded-[16px] bg-surface-2" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="card flex flex-col items-center p-12 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-accent/12 text-accent-text">
            <Send className="size-6" />
          </span>
          <p className="title mt-4 text-ink">Nothing here yet</p>
          <p className="mt-1 text-ink-2">Payments you send will show up here, live.</p>
          <ButtonLink href="/app" className="mt-6">
            Send a payment
          </ButtonLink>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groups).map(([day, list]) => (
            <section key={day}>
              <h2 className="mb-2 px-1 text-[0.8rem] font-bold text-ink-3">{day}</h2>
              <div className="card divide-y divide-hairline overflow-hidden">
                {list.map((payment) => (
                  <Link
                    key={payment.id}
                    href={`/app/activity/${payment.id}`}
                    className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-surface-2 sm:px-5"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-3 text-[0.78rem] font-bold text-ink">
                      {initials(payment.payee.registeredName)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[0.98rem] font-bold tracking-[-0.032em] text-ink">
                        {payment.payee.registeredName}
                      </p>
                      <p className="mono truncate text-[0.72rem] text-ink-3">
                        {payment.reference} · {payment.card.brand} •••• {payment.card.last4}
                      </p>
                    </div>
                    <div className="hidden text-right sm:block">
                      <p className="font-bold text-ink tnum">{rwf(payment.amountRwf)}</p>
                      <p className="text-[0.8rem] text-ink-3 tnum">{payment.totalCardDisplay}</p>
                    </div>
                    <StatusPill status={payment.status} />
                    <ChevronRight className="size-4 text-ink-3" />
                  </Link>
                ))}
              </div>
            </section>
          ))}
          {payments.hasNextPage && (
            <Button
              variant="secondary"
              onClick={() => payments.fetchNextPage()}
              loading={payments.isFetchingNextPage}
              className="w-full"
            >
              Load more
            </Button>
          )}
        </div>
      )}
      {payments.isFetching && !payments.isLoading && <Spinner className="mt-4 size-4 text-ink-3" />}
    </div>
  );
}
