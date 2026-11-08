'use client';

import { createContext, useCallback, useContext, useMemo } from 'react';
import { useBrowserValue, useLocalStorage, writeStorage } from './browser-store';
import type { HustleResult, Persona, WaitlistStatus } from './types';

interface LaunchState {
  persona: Persona | null;
  setPersona: (persona: Persona) => void;
  result: HustleResult | null;
  setResult: (result: HustleResult) => void;
  declassified: boolean;
  joined: WaitlistStatus | null;
  setJoined: (status: WaitlistStatus) => void;
  referralCode: string | null;
}

const LaunchContext = createContext<LaunchState | null>(null);
const STORAGE_KEY = 'xd-launch';

/** Website state shared by the Hustle Check, the classified files and the waitlist forms. */
export function LaunchProvider({ children }: { children: React.ReactNode }) {
  const raw = useLocalStorage(STORAGE_KEY);
  const saved = useMemo(() => {
    try {
      return JSON.parse(raw ?? '{}') as {
        result?: HustleResult;
        joined?: WaitlistStatus;
        persona?: Persona;
      };
    } catch {
      return {};
    }
  }, [raw]);
  const search = useBrowserValue(() => window.location.search, '');
  const ref = new URLSearchParams(search).get('ref')?.toUpperCase() ?? null;
  const referralCode = ref && /^[A-HJKMNP-Z2-9]{8}$/.test(ref) ? ref : null;

  const persist = useCallback((patch: Record<string, unknown>) => {
    let current: Record<string, unknown> = {};
    try {
      current = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    } catch {
      /* start fresh */
    }
    writeStorage(STORAGE_KEY, JSON.stringify({ ...current, ...patch }));
  }, []);

  const value: LaunchState = {
    persona: saved.persona ?? null,
    setPersona: (next) => persist({ persona: next }),
    result: saved.result ?? null,
    setResult: (next) => persist({ result: next }),
    declassified: Boolean(saved.result),
    joined: saved.joined ?? null,
    setJoined: (next) => persist({ joined: next }),
    referralCode,
  };
  return <LaunchContext.Provider value={value}>{children}</LaunchContext.Provider>;
}

export function useLaunch(): LaunchState {
  const value = useContext(LaunchContext);
  if (!value) throw new Error('useLaunch outside LaunchProvider');
  return value;
}

export const PERSONA_LABELS: Record<Persona, string> = {
  VISITOR: 'Visiting Rwanda (or planning to)',
  SENDER: 'A foreigner sending money to Rwanda',
  DIASPORA: 'A Rwandan living abroad',
  RECEIVER: 'In Rwanda, receiving money',
};
