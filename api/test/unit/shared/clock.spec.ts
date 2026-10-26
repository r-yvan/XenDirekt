import {
  formatKigaliDateTime,
  kigaliBusinessDate,
  ManualClock,
  startOfKigaliDay,
} from '../../../src/shared/time/clock';

describe('Kigali business time', () => {
  it('maps UTC instants onto the Kigali calendar day (UTC+2, no DST)', () => {
    expect(kigaliBusinessDate(new Date('2026-11-02T21:59:59Z'))).toBe('2026-11-02');
    expect(kigaliBusinessDate(new Date('2026-11-02T22:00:00Z'))).toBe('2026-11-03');
  });

  it('computes the UTC start of a Kigali day', () => {
    expect(startOfKigaliDay(new Date('2026-11-03T05:00:00Z')).toISOString()).toBe(
      '2026-11-02T22:00:00.000Z',
    );
    expect(startOfKigaliDay(new Date('2026-11-02T22:00:00Z')).toISOString()).toBe(
      '2026-11-02T22:00:00.000Z',
    );
  });

  it('formats receipt time in Kigali time', () => {
    const formatted = formatKigaliDateTime(new Date('2026-11-02T08:00:00Z'), 'en');
    expect(formatted).toContain('10:00');
    expect(formatted).toContain('2026');
  });

  it('manual clock only moves when told to', () => {
    const clock = new ManualClock('2026-11-02T08:00:00Z');
    expect(clock.now().toISOString()).toBe('2026-11-02T08:00:00.000Z');
    clock.advance(120_000);
    expect(clock.now().toISOString()).toBe('2026-11-02T08:02:00.000Z');
  });
});
