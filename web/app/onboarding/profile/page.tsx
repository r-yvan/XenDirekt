'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useBrowserValue } from '@/lib/browser-store';
import { AuthShell } from '@/components/auth/auth-shell';
import { ProfileIllustration } from '@/components/auth/illustrations';
import { Button } from '@/components/ui/button';
import { ApiError, api } from '@/lib/api';
import { COUNTRY_CODES } from '@/lib/countries';
import { countryName, flag } from '@/lib/format';
import { nextStepFor, useProfile, useSignedOutRedirect } from '@/lib/session';
import type { AppConfig, Profile } from '@/lib/types';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export default function ProfileStep() {
  useSignedOutRedirect();
  const router = useRouter();
  const queryClient = useQueryClient();
  const me = useProfile();
  const config = useQuery({
    queryKey: ['app-config'],
    queryFn: () => api<AppConfig>('v1/app-config'),
  });
  const [nameEdit, setName] = useState<string | null>(null);
  const [countryEdit, setCountry] = useState<string | null>(null);
  // Prefill the country from the browser's region (never Rwanda) and the name from the profile.
  const region = useBrowserValue(() => {
    const code = new Intl.Locale(navigator.language).maximize().region ?? '';
    return code !== 'RW' && COUNTRY_CODES.includes(code) ? code : '';
  }, '');
  const name = nameEdit ?? me.data?.fullName ?? '';
  const country = countryEdit ?? region;
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (me.data?.profileComplete) router.replace(nextStepFor(me.data));
  }, [me.data, router]);

  const countries = useMemo(
    () =>
      COUNTRY_CODES.map((code) => ({ code, name: countryName(code) })).sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    [],
  );
  const thisYear = new Date().getFullYear();
  const complete = name.trim().length >= 2 && country && day && month && year;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!complete) return;
    setBusy(true);
    setError(null);
    try {
      const profile = await api<Profile>('v1/me', {
        method: 'PATCH',
        body: {
          fullName: name.trim(),
          countryOfResidence: country,
          dateOfBirth: `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`,
          preferredLanguage: 'en',
          acceptLegalTerms: true,
        },
      });
      queryClient.setQueryData(['me'], profile);
      router.replace(nextStepFor(profile));
    } catch (failure) {
      setError(
        failure instanceof ApiError && failure.code === 'VALIDATION_FAILED'
          ? 'Check your details. You need to be 18 or older to use XenDirekt.'
          : failure instanceof ApiError
            ? failure.message
            : 'Something went wrong.',
      );
      setBusy(false);
    }
  }

  return (
    <AuthShell
      step={2}
      title="A little about you"
      subtitle="A few details keep your payments safe. It takes 30 seconds."
      illustration={<ProfileIllustration />}
      caption="Your name and country help us check every payment is really you. They’re never shown to the people you pay."
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="name" className="text-[0.85rem] font-bold text-ink-2">
            Full name
          </label>
          <input
            id="name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="field mt-2"
            placeholder="As on your card"
          />
        </div>
        <div>
          <label htmlFor="country" className="text-[0.85rem] font-bold text-ink-2">
            Country you live in
          </label>
          <select
            id="country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="field mt-2"
          >
            <option value="">Choose a country</option>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {flag(c.code)} {c.name}
              </option>
            ))}
          </select>
        </div>
        <fieldset>
          <legend className="text-[0.85rem] font-bold text-ink-2">Date of birth</legend>
          <div className="mt-2 grid grid-cols-[1fr_1.6fr_1.2fr] gap-2">
            <select
              aria-label="Day"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              className="field"
            >
              <option value="">Day</option>
              {Array.from({ length: 31 }, (_, i) => (
                <option key={i} value={String(i + 1)}>
                  {i + 1}
                </option>
              ))}
            </select>
            <select
              aria-label="Month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="field"
            >
              <option value="">Month</option>
              {MONTHS.map((m, i) => (
                <option key={m} value={String(i + 1)}>
                  {m}
                </option>
              ))}
            </select>
            <select
              aria-label="Year"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="field"
            >
              <option value="">Year</option>
              {Array.from({ length: 90 }, (_, i) => thisYear - 18 - i).map((y) => (
                <option key={y} value={String(y)}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </fieldset>
        <div className="flex gap-3 rounded-[14px] border border-hairline bg-surface-1 p-4 text-[0.88rem] leading-relaxed text-ink-2">
          <ShieldCheck className="mt-0.5 size-4.5 shrink-0 text-success" />
          <p>
            By continuing you accept the{' '}
            <a
              href={config.data?.legal.termsUrl ?? '#'}
              target="_blank"
              rel="noreferrer"
              className="font-bold text-accent-text"
            >
              Terms of Service
            </a>{' '}
            and{' '}
            <a
              href={config.data?.legal.privacyUrl ?? '#'}
              target="_blank"
              rel="noreferrer"
              className="font-bold text-accent-text"
            >
              Privacy Policy
            </a>
            .
          </p>
        </div>
        {error && (
          <p role="alert" className="text-[0.9rem] font-medium text-error">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" disabled={!complete} loading={busy}>
          Continue <ArrowRight className="size-4.5" />
        </Button>
      </form>
    </AuthShell>
  );
}
