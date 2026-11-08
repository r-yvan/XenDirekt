'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ApiError, SIGNED_OUT_EVENT, api } from './api';
import { writeStorage } from './browser-store';
import type { OtpChallenge, Profile } from './types';

export function useProfile(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => api<Profile>('v1/me'),
    retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
    enabled: options.enabled ?? true,
  });
}

/** Where a signed-in person belongs, given their onboarding state. */
export function nextStepFor(profile: Profile): string {
  if (!profile.profileComplete) return '/onboarding/profile';
  if (!profile.pinSet) return '/onboarding/pin';
  return '/app';
}

/** Sends the user to sign-in whenever the session ends (any 401 from the API). */
export function useSignedOutRedirect() {
  const router = useRouter();
  useEffect(() => {
    const handler = () => router.replace('/sign-in?expired=1');
    window.addEventListener(SIGNED_OUT_EVENT, handler);
    return () => window.removeEventListener(SIGNED_OUT_EVENT, handler);
  }, [router]);
}

export const PENDING_KEY = 'xd-pending-otp';

export function savePendingOtp(value: { email: string; challenge: OtpChallenge }) {
  writeStorage(PENDING_KEY, JSON.stringify(value), 'session');
}

export function readPendingOtp(): { email: string; challenge: OtpChallenge } | null {
  try {
    return JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? 'null');
  } catch {
    return null;
  }
}

export function clearPendingOtp() {
  writeStorage(PENDING_KEY, null, 'session');
}

export async function signOut() {
  await fetch('/api/session/refresh', { method: 'POST' }).catch(() => undefined);
  await fetch('/api/session/logout', { method: 'POST' });
}
