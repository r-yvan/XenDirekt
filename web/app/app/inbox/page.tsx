'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Bell } from 'lucide-react';
import Link from 'next/link';
import { PageTitle } from '@/components/portal/shell';
import { api } from '@/lib/api';
import { dateTime } from '@/lib/format';
import type { Notification } from '@/lib/types';

export default function InboxPage() {
  const queryClient = useQueryClient();
  const inbox = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api<{ notifications: Notification[]; unread: number }>('v1/notifications'),
  });
  const read = useMutation({
    mutationFn: (id: string) => api(`v1/notifications/${id}/read`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const items = inbox.data?.notifications ?? [];
  return (
    <div>
      <PageTitle
        title="Inbox"
        subtitle={inbox.data?.unread ? `${inbox.data.unread} unread` : 'You’re all caught up.'}
      />
      {items.length === 0 && !inbox.isLoading ? (
        <div className="card flex flex-col items-center p-12 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-accent/12 text-accent-text">
            <Bell className="size-6" />
          </span>
          <p className="title mt-4 text-ink">No messages yet</p>
          <p className="mt-1 text-ink-2">Payment updates land here the moment they happen.</p>
        </div>
      ) : (
        <div className="card divide-y divide-hairline overflow-hidden">
          {items.map((item) => (
            <Link
              key={item.id}
              href={item.paymentId ? `/app/activity/${item.paymentId}` : '#'}
              onClick={() => !item.read && read.mutate(item.id)}
              className="flex gap-4 px-5 py-4 transition-colors hover:bg-surface-2"
            >
              <span
                className={clsx(
                  'mt-2 size-2 shrink-0 rounded-full',
                  item.read ? 'bg-transparent' : 'bg-accent',
                )}
              />
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-3">
                  <p
                    className={clsx(
                      'tracking-[-0.032em] text-ink',
                      item.read ? 'font-medium' : 'font-bold',
                    )}
                  >
                    {item.title}
                  </p>
                  <span className="shrink-0 text-[0.78rem] text-ink-3">
                    {dateTime(item.createdAt)}
                  </span>
                </div>
                <p className="mt-0.5 text-[0.9rem] text-ink-2">{item.body}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
