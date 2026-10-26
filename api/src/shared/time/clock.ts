/**
 * All business time reads go through Clock so tests can control expiry, the 2-minute review
 * rule and daily limits deterministically. Storage is always UTC (timestamptz).
 */
export abstract class Clock {
  abstract now(): Date;

  nowMs(): number {
    return this.now().getTime();
  }

  plusMs(ms: number): Date {
    return new Date(this.nowMs() + ms);
  }
}

export class SystemClock extends Clock {
  now(): Date {
    return new Date();
  }
}

/** Test clock: frozen until advanced. */
export class ManualClock extends Clock {
  private current: number;

  constructor(start: Date | string = '2026-11-02T08:00:00.000Z') {
    super();
    this.current = new Date(start).getTime();
  }

  now(): Date {
    return new Date(this.current);
  }

  advance(ms: number): void {
    this.current += ms;
  }

  set(date: Date | string): void {
    this.current = new Date(date).getTime();
  }
}

/**
 * Kigali business time. Africa/Kigali is UTC+02:00 with no daylight saving, so a business day
 * starts at 22:00 UTC the previous evening.
 */
export const KIGALI_TIME_ZONE = 'Africa/Kigali';

const kigaliDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: KIGALI_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** 'YYYY-MM-DD' of the Kigali calendar day containing `date`. */
export function kigaliBusinessDate(date: Date): string {
  return kigaliDateFormatter.format(date);
}

/** UTC instant at which the Kigali calendar day containing `date` started. */
export function startOfKigaliDay(date: Date): Date {
  return new Date(`${kigaliBusinessDate(date)}T00:00:00+02:00`);
}

/** Receipt timestamp, e.g. "2 Nov 2026, 10:00" (en) / "2 nov. 2026, 10:00" (fr), Kigali time. */
export function formatKigaliDateTime(date: Date, locale: 'en' | 'fr' = 'en'): string {
  return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-RW' : 'en-GB', {
    timeZone: KIGALI_TIME_ZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}
