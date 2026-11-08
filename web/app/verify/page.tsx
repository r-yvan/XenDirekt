'use client';

import { useQueryClient } from '@tanstack/react-query';
import { RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { AuthShell } from '@/components/auth/auth-shell';
import { CodeInput } from '@/components/auth/code-input';
import { CodeIllustration } from '@/components/auth/illustrations';
import { Spinner } from '@/components/ui/spinner';
import { ApiError, api, messageFor } from '@/lib/api';
import { useBrowserValue, useLocalStorage } from '@/lib/browser-store';
import { PENDING_KEY, clearPendingOtp, nextStepFor, savePendingOtp } from '@/lib/session';
import type { OtpChallenge, Profile } from '@/lib/types';

export default function VerifyPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const raw = useLocalStorage(PENDING_KEY, 'session');
  const hydrated = useBrowserValue(() => true, false);
  const pending = useMemo(() => {
    try {
      return raw ? (JSON.parse(raw) as { email: string; challenge: OtpChallenge }) : null;
    } catch {
      return null;
    }
  }, [raw]);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (hydrated && !pending && !busy) router.replace('/sign-in');
  }, [hydrated, pending, busy, router]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  async function verify(value: string) {
    if (!pending || busy) return;
    setBusy(true);
    setError(null);
    const response = await fetch('/api/session/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId: pending.challenge.challengeId, otp: value }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as {
        error?: { code?: string; details?: Record<string, unknown> };
      };
      setError(messageFor(body.error?.code ?? 'INTERNAL_ERROR', body.error?.details));
      setCode('');
      setBusy(false);
      return;
    }
    clearPendingOtp();
    const profile = await api<Profile>('v1/me');
    queryClient.setQueryData(['me'], profile);
    router.replace(nextStepFor(profile));
  }

  async function resend() {
    if (!pending) return;
    try {
      const challenge = await api<OtpChallenge>('v1/auth/otp', {
        method: 'POST',
        body: { channel: 'EMAIL', destination: pending.email, locale: 'en' },
      });
      savePendingOtp({ email: pending.email, challenge });
      setError(null);
      setCode('');
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : 'Couldn’t send a new code.');
    }
  }

  const wait = pending
    ? Math.max(0, Math.ceil((new Date(pending.challenge.resendAvailableAt).getTime() - now) / 1000))
    : 0;

  return (
    <AuthShell
      step={1}
      back="/sign-in"
      title="Check your email"
      subtitle={
        pending ? (
          <>
            We sent a 6-digit code to{' '}
            <span className="font-bold text-ink">{pending.challenge.destinationMasked}</span>.
          </>
        ) : null
      }
      illustration={<CodeIllustration />}
      caption="Your session is tied to this browser. Signing in here signs out any older session on it."
    >
      <CodeInput
        label="One-time code"
        value={code}
        onChange={setCode}
        onComplete={verify}
        disabled={busy}
        error={Boolean(error)}
      />
      <div className="mt-5 flex min-h-8 items-center justify-between">
        {busy ? (
          <span className="flex items-center gap-2 text-[0.9rem] text-ink-2">
            <Spinner className="size-4" /> Checking…
          </span>
        ) : error ? (
          <p role="alert" className="text-[0.9rem] font-medium text-error">
            {error}
          </p>
        ) : (
          <span />
        )}
        {wait > 0 ? (
          <span className="mono rounded-full border border-hairline px-3 py-1 text-[0.72rem] text-ink-3 tnum">
            New code in {wait}s
          </span>
        ) : (
          <button
            onClick={resend}
            className="inline-flex items-center gap-1.5 text-[0.9rem] font-bold text-accent-text"
          >
            <RotateCcw className="size-4" /> Send a new code
          </button>
        )}
      </div>
    </AuthShell>
  );
}
