'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { useState } from 'react';
import { PageTitle } from '@/components/portal/shell';
import { Button } from '@/components/ui/button';
import { ApiError, api } from '@/lib/api';
import { dateTime } from '@/lib/format';
import type { Ticket } from '@/lib/types';

const CATEGORIES = [
  ['APP_PROBLEM', 'Something isn’t working'],
  ['REFUND_REQUEST', 'I’d like a refund'],
  ['OTHER', 'Something else'],
] as const;

export default function HelpPage() {
  const queryClient = useQueryClient();
  const tickets = useQuery({
    queryKey: ['tickets'],
    queryFn: () => api<{ tickets: Ticket[] }>('v1/tickets'),
  });
  const [category, setCategory] = useState<string>('APP_PROBLEM');
  const [message, setMessage] = useState('');
  const create = useMutation({
    mutationFn: () =>
      api<Ticket>('v1/tickets', {
        method: 'POST',
        body: { category, message: message.trim() || undefined },
      }),
    onSuccess: () => {
      setMessage('');
      void queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
  });
  return (
    <div>
      <PageTitle
        title="Help"
        subtitle="For a specific payment, open it from Activity and choose “Report a problem”."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <form
          className="card space-y-3 p-6"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <p className="title text-ink">Contact support</p>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="field">
            {CATEGORIES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            maxLength={1000}
            placeholder="Tell us what happened"
            className="field h-auto py-3"
          />
          {create.isSuccess && (
            <p className="flex items-center gap-2 text-[0.9rem] text-success">
              <Check className="size-4" /> Ticket {create.data.reference} opened. We’ll reply by
              email.
            </p>
          )}
          {create.isError && (
            <p className="text-[0.9rem] text-error">
              {create.error instanceof ApiError ? create.error.message : 'Couldn’t send.'}
            </p>
          )}
          <Button type="submit" loading={create.isPending}>
            Send
          </Button>
        </form>
        <div className="card p-6">
          <p className="title text-ink">Your tickets</p>
          {(tickets.data?.tickets ?? []).length === 0 ? (
            <p className="mt-3 text-ink-2">No tickets yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-hairline">
              {tickets.data!.tickets.map((ticket) => (
                <li key={ticket.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="mono text-[0.8rem] font-bold text-ink">{ticket.reference}</p>
                    <p className="text-[0.85rem] text-ink-3">
                      {ticket.category.replace(/_/g, ' ').toLowerCase()} ·{' '}
                      {dateTime(ticket.createdAt)}
                    </p>
                  </div>
                  <span className="rounded-full bg-surface-3 px-2.5 py-1 text-[0.75rem] font-bold text-ink-2">
                    {ticket.status.replace('_', ' ').toLowerCase()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
