'use client';

import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  Bell,
  CircleHelp,
  CreditCard,
  FlaskConical,
  History,
  LogOut,
  Send,
  Settings,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Logo } from '@/components/ui/logo';
import { RevealWords } from '@/components/ui/reveal';
import { Spinner } from '@/components/ui/spinner';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { api } from '@/lib/api';
import { initials } from '@/lib/format';
import { nextStepFor, signOut, useProfile, useSignedOutRedirect } from '@/lib/session';
import type { AppConfig, Notification } from '@/lib/types';

const NAV = [
  { href: '/app', label: 'Send', icon: Send },
  { href: '/app/activity', label: 'Activity', icon: History },
  { href: '/app/cards', label: 'Cards', icon: CreditCard },
  { href: '/app/inbox', label: 'Inbox', icon: Bell },
  { href: '/app/help', label: 'Help', icon: CircleHelp },
  { href: '/app/settings', label: 'Settings', icon: Settings },
];

export function PortalShell({ children }: { children: React.ReactNode }) {
  useSignedOutRedirect();
  const router = useRouter();
  const pathname = usePathname();
  const me = useProfile();
  const config = useQuery({
    queryKey: ['app-config'],
    queryFn: () => api<AppConfig>('v1/app-config'),
    staleTime: 300_000,
  });
  const inbox = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api<{ notifications: Notification[]; unread: number }>('v1/notifications'),
    enabled: Boolean(me.data?.pinSet),
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (me.data && (!me.data.profileComplete || !me.data.pinSet))
      router.replace(nextStepFor(me.data));
  }, [me.data, router]);

  if (!me.data || !me.data.pinSet) {
    return (
      <div className="grid min-h-dvh place-items-center">
        {me.isError ? (
          <div className="text-center">
            <p className="text-ink-2">We couldn’t load your account.</p>
            <Link href="/sign-in" className="mt-3 inline-block font-bold text-accent-text">
              Sign in again
            </Link>
          </div>
        ) : (
          <Spinner className="size-6 text-ink-3" />
        )}
      </div>
    );
  }

  const unread = inbox.data?.unread ?? 0;
  const active = (href: string) =>
    href === '/app' ? pathname === '/app' : pathname.startsWith(href);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-hairline bg-surface-1/50 p-3 lg:flex">
        <div className="px-2 py-2">
          <Logo href="/app" />
        </div>
        <nav className="mt-6 space-y-0.5" aria-label="Portal">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={active(href) ? 'page' : undefined}
              className={clsx(
                'flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[0.92rem] font-medium tracking-[-0.026em] transition-colors',
                active(href)
                  ? 'bg-surface-3 text-ink'
                  : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
              )}
            >
              <Icon className={clsx('size-4.5', active(href) && 'text-accent-text')} />
              {label}
              {href === '/app/inbox' && unread > 0 && (
                <span className="ml-auto rounded-full bg-accent px-1.5 text-[0.7rem] font-bold text-on-accent tnum">
                  {unread}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <div className="mt-auto space-y-3">
          <ThemeToggle />
          <div className="flex items-center gap-2.5 rounded-[12px] border border-hairline bg-surface-1 p-2.5">
            <span className="grid size-9 place-items-center rounded-full bg-accent/14 text-[0.8rem] font-bold text-accent-text">
              {initials(me.data.fullName)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.88rem] font-bold tracking-[-0.032em] text-ink">
                {me.data.fullName}
              </p>
              <p className="truncate text-[0.75rem] text-ink-3">{me.data.email}</p>
            </div>
            <button
              title="Sign out"
              aria-label="Sign out"
              className="grid size-8 place-items-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-ink"
              onClick={async () => {
                await signOut();
                router.replace('/sign-in');
              }}
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>
      <div className="flex min-h-dvh flex-col pb-20 lg:pb-0">
        {config.data?.providerMode === 'SANDBOX' && (
          <div className="flex items-center justify-center gap-2 border-b border-hairline bg-warning/10 px-4 py-2 text-center text-[0.8rem] font-bold text-warning">
            <FlaskConical className="size-3.5" /> Sandbox: no real cards are charged and no real
            money moves.
          </div>
        )}
        {config.data?.banner?.kind === 'PAYMENTS_PAUSED' && (
          <div className="border-b border-hairline bg-error/10 px-4 py-2 text-center text-[0.8rem] font-bold text-error">
            Payments are paused for a moment. You can still see your activity.
          </div>
        )}
        <header className="flex items-center justify-between border-b border-hairline px-5 py-3 lg:hidden">
          <Logo href="/app" />
          <ThemeToggle />
        </header>
        <main className="mx-auto w-full max-w-[1080px] flex-1 px-5 py-8 sm:px-8 sm:py-10">
          {children}
        </main>
      </div>
      {/* Mobile tab bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-hairline bg-canvas/90 backdrop-blur-xl lg:hidden"
        aria-label="Portal"
      >
        {NAV.slice(0, 5).map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={clsx(
              'flex flex-col items-center gap-1 py-2.5 text-[0.7rem] font-medium',
              active(href) ? 'text-accent-text' : 'text-ink-3',
            )}
          >
            <Icon className="size-5" />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function PageTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <RevealWords
          key={title}
          as="h1"
          trigger="mount"
          stagger={0.05}
          text={title}
          className="text-[2rem] leading-tight font-bold tracking-[-0.072em] text-ink"
        />
        {subtitle && <p className="mt-1 text-[1rem] text-ink-2">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
