'use client';

import { useMutation } from '@tanstack/react-query';
import { Button, ButtonLink } from '@/components/ui/button';
import { RevealWords } from '@/components/ui/reveal';
import { ScrambleText } from '@/components/ui/text-effects';
import { ApiError, api } from '@/lib/api';

/** Deleting needs a click: link scanners in mail clients must not remove people. */
export function LeaveWaitlist({ token }: { token: string }) {
  const leave = useMutation({
    mutationFn: () => api('v1/launch/waitlist/leave', { method: 'POST', body: { token } }),
  });
  return (
    <div className="mx-auto max-w-[560px]">
      <ScrambleText as="p" trigger="mount" text="The waitlist" className="eyebrow" />
      <RevealWords
        key={leave.isSuccess ? 'left' : 'ask'}
        as="h1"
        trigger="mount"
        text={leave.isSuccess ? 'You’ve left the list.' : 'Leave the waitlist?'}
        className="display mt-3 text-ink"
      />
      <p className="lead mt-5">
        {leave.isSuccess
          ? 'Your email and details are deleted. You can join again any time.'
          : 'We’ll delete your email and details. You won’t hear from us about the launch.'}
      </p>
      <div className="mt-8 flex gap-3">
        {leave.isSuccess ? (
          <ButtonLink href="/">Back to XenDirekt</ButtonLink>
        ) : (
          <>
            <Button
              variant="danger"
              loading={leave.isPending}
              onClick={() => leave.mutate()}
              disabled={!token}
            >
              Leave and delete my details
            </Button>
            <ButtonLink href="/" variant="secondary">
              Stay on the list
            </ButtonLink>
          </>
        )}
      </div>
      {leave.isError && (
        <p role="alert" className="mt-4 text-error">
          {leave.error instanceof ApiError && leave.error.code === 'NOT_FOUND'
            ? 'This link is no longer valid. You may have already left the list.'
            : 'Something went wrong. Try again.'}
        </p>
      )}
    </div>
  );
}
