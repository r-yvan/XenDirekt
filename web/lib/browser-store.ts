'use client';

import { useSyncExternalStore } from 'react';

/**
 * Browser-only values read without setState-in-effect: the server snapshot is the fallback, the
 * client reads the real value, and React reconciles after hydration.
 */
const STORAGE_EVENT = 'xd:storage';

function subscribeStorage(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener(STORAGE_EVENT, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(STORAGE_EVENT, callback);
  };
}

export function useLocalStorage(key: string, area: 'local' | 'session' = 'local'): string | null {
  return useSyncExternalStore(
    subscribeStorage,
    () => {
      try {
        return (area === 'local' ? localStorage : sessionStorage).getItem(key);
      } catch {
        return null;
      }
    },
    () => null,
  );
}

export function writeStorage(
  key: string,
  value: string | null,
  area: 'local' | 'session' = 'local',
) {
  try {
    const store = area === 'local' ? localStorage : sessionStorage;
    if (value === null) store.removeItem(key);
    else store.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new Event(STORAGE_EVENT));
}

const noopSubscribe = () => () => {};

/** A value computed once from browser APIs (navigator, location); `fallback` on the server. */
export function useBrowserValue<T extends string | boolean | null>(read: () => T, fallback: T): T {
  return useSyncExternalStore(noopSubscribe, read, () => fallback);
}

export function useMediaQuery(query: string, fallback = false): boolean {
  return useSyncExternalStore(
    (callback) => {
      const media = window.matchMedia(query);
      media.addEventListener('change', callback);
      return () => media.removeEventListener('change', callback);
    },
    () => window.matchMedia(query).matches,
    () => fallback,
  );
}
