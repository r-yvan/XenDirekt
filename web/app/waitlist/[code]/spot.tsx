'use client';

import { useQuery } from '@tanstack/react-query';
import { JoinedCard } from '@/components/site/waitlist-form';
import { ButtonLink } from '@/components/ui/button';
import { RevealWords } from '@/components/ui/reveal';
import { Spinner } from '@/components/ui/spinner';
import { ScrambleText } from '@/components/ui/text-effects';
import { api } from '@/lib/api';
import { compactNumber } from '@/lib/format';
import type { WaitlistStatus } from '@/lib/types';

export function WaitlistSpot({ code }: { code: string }) {
  const status = useQuery({
    queryKey: ['spot', code],
    queryFn: () => api<WaitlistStatus>(`v1/launch/waitlist/${code}`),
    retry: false,
  });
  return (
    <div className="mx-auto max-w-[560px]">
      <ScrambleText as="p" trigger="mount" text="The waitlist" className="eyebrow" />
      <RevealWords
        as="h1"
        trigger="mount"
        text="Your spot in line."
        className="display mt-3 text-ink"
      />
      <div className="mt-10">
        {status.isLoading && <Spinner className="size-6 text-ink-3" />}
        {status.data && (
          <>
            <JoinedCard status={{ ...status.data, alreadyJoined: true }} />
            <p className="mt-4 text-[0.9rem] text-ink-3">
              {compactNumber(status.data.total)} people are on the list.
            </p>
          </>
        )}
        {status.isError && (
          <div className="card p-6">
            <p className="title text-ink">We can’t find that spot.</p>
            <p className="mt-2 text-ink-2">
              The link may be mistyped, or the person left the list.
            </p>
            <ButtonLink href="/#join" className="mt-5">
              Join the waitlist
            </ButtonLink>
          </div>
        )}
      </div>
    </div>
  );
}
