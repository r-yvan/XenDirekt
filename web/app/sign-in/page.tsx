'use client';

import { ArrowRight, Mail } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { AuthShell } from '@/components/auth/auth-shell';
import { EmailIllustration } from '@/components/auth/illustrations';
import { Button } from '@/components/ui/button';
import { ApiError, api } from '@/lib/api';
import { savePendingOtp } from '@/lib/session';
import type { OtpChallenge } from '@/lib/types';

function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const expired = params.get('expired') === '1';
  // The website's "Create account" button; the flow is the same either way.
  const creating = params.get('new') === '1';
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    expired ? 'Your session ended. Sign in again.' : null,
  );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
      setError('Enter a valid email address.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const challenge = await api<OtpChallenge>('v1/auth/otp', {
        method: 'POST',
        body: { channel: 'EMAIL', destination: value, locale: 'en' },
      });
      savePendingOtp({ email: value, challenge });
      router.push('/verify');
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : 'Something went wrong. Try again.');
      setBusy(false);
    }
  }

  return (
    <AuthShell
      step={1}
      back="/"
      title={creating ? 'Create your account' : 'Sign in or create your account'}
      subtitle="Enter your email and we’ll send you a 6-digit code. No password needed."
      illustration={<EmailIllustration />}
      caption="One code, straight to your inbox. It expires in a few minutes and works only once."
    >
      <form onSubmit={submit} noValidate>
        <label htmlFor="email" className="text-[0.85rem] font-bold tracking-[-0.02em] text-ink-2">
          Email
        </label>
        <div className="relative mt-2">
          <Mail className="pointer-events-none absolute top-1/2 left-4 size-4.5 -translate-y-1/2 text-ink-3" />
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoFocus
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="field pl-11"
            aria-invalid={Boolean(error)}
          />
        </div>
        {error && (
          <p role="alert" className="mt-3 text-[0.9rem] font-medium text-error">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" loading={busy} className="mt-6 w-full">
          Continue <ArrowRight className="size-4.5" />
        </Button>
        <p className="mt-5 text-center text-[0.85rem] text-ink-3">
          {creating
            ? 'Already have an account? The same code signs you in.'
            : 'New here? The same code creates your account.'}
        </p>
      </form>
    </AuthShell>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
