'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AuthShell } from '@/components/auth/auth-shell';
import { CodeInput } from '@/components/auth/code-input';
import { PinIllustration } from '@/components/auth/illustrations';
import { Spinner } from '@/components/ui/spinner';
import { ApiError, api } from '@/lib/api';
import { useProfile, useSignedOutRedirect } from '@/lib/session';

export default function PinStep() {
  useSignedOutRedirect();
  const router = useRouter();
  const queryClient = useQueryClient();
  const me = useProfile();
  const [first, setFirst] = useState<string | null>(null);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (me.data && !me.data.profileComplete) router.replace('/onboarding/profile');
    // While saving, this page navigates itself (with the welcome note).
    if (me.data?.pinSet && !busy) router.replace('/app');
  }, [me.data, router, busy]);

  async function complete(pin: string) {
    if (!first) {
      setFirst(pin);
      setValue('');
      setError(null);
      return;
    }
    if (pin !== first) {
      setFirst(null);
      setValue('');
      setError('The PINs didn’t match. Start again.');
      return;
    }
    setBusy(true);
    try {
      await api('v1/me/pin', { method: 'POST', body: { pin } });
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      router.replace('/app?welcome=1');
    } catch (failure) {
      setFirst(null);
      setValue('');
      setBusy(false);
      setError(
        failure instanceof ApiError && failure.code === 'VALIDATION_FAILED'
          ? 'Choose a less predictable PIN (no repeats or sequences like 123456).'
          : failure instanceof ApiError
            ? failure.message
            : 'Something went wrong.',
      );
    }
  }

  return (
    <AuthShell
      step={3}
      title={first ? 'Enter it once more' : 'Create a 6-digit PIN'}
      subtitle="You’ll confirm every payment with it. Avoid birthdays and simple sequences."
      illustration={<PinIllustration filled={value.length} />}
      caption="Your PIN is checked by our servers, never stored in your browser. Too many wrong tries locks it for a while."
    >
      <CodeInput
        key={first ? 'confirm' : 'create'}
        label={first ? 'Confirm PIN' : 'New PIN'}
        secret
        value={value}
        onChange={setValue}
        onComplete={complete}
        disabled={busy}
        error={Boolean(error)}
      />
      <div className="mt-5 min-h-6">
        {busy ? (
          <span className="flex items-center gap-2 text-[0.9rem] text-ink-2">
            <Spinner className="size-4" /> Saving your PIN…
          </span>
        ) : error ? (
          <p role="alert" className="text-[0.9rem] font-medium text-error">
            {error}
          </p>
        ) : null}
      </div>
    </AuthShell>
  );
}
