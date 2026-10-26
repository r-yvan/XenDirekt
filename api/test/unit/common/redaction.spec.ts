import {
  maskEmail,
  maskName,
  maskPhone,
  firstName,
  maskLocalMsisdn,
} from '../../../src/common/logging/masking';
import { passesLuhn, redact, scrubCardNumbers } from '../../../src/common/logging/redaction';

describe('card number scrubbing', () => {
  it('recognises Luhn-valid card numbers', () => {
    expect(passesLuhn('4242424242424242')).toBe(true);
    expect(passesLuhn('4242424242424241')).toBe(false);
  });

  it('removes card numbers in any common formatting', () => {
    expect(scrubCardNumbers('card 4242424242424242 declined')).toBe('card [REDACTED_PAN] declined');
    expect(scrubCardNumbers('4242 4242 4242 4242')).toBe('[REDACTED_PAN]');
    expect(scrubCardNumbers('5555-5555-5555-4444')).toBe('[REDACTED_PAN]');
  });

  it('leaves phone numbers and non-Luhn digit runs alone', () => {
    expect(scrubCardNumbers('call 0788123456')).toBe('call 0788123456');
    expect(scrubCardNumbers('ref 4242424242424241')).toBe('ref 4242424242424241');
  });
});

describe('redact', () => {
  it('drops secrets, masks personal fields and scrubs nested strings', () => {
    const output = redact({
      authorization: 'Bearer abc',
      pin: '123456',
      otp: '654321',
      'X-XENTRIPAY-KEY': 'live_key',
      email: 'jane@example.com',
      msisdn: '0788302208',
      validatedAccountName: 'John Doe',
      nested: { note: 'paid with 4242424242424242', amount: 500, status: 'PENDING', code: 'X1' },
      list: [{ cvv: '123' }],
      big: 10n,
    });
    expect(output).toEqual({
      authorization: '[REDACTED]',
      pin: '[REDACTED]',
      otp: '[REDACTED]',
      'X-XENTRIPAY-KEY': '[REDACTED]',
      email: 'ja***om',
      msisdn: '07***08',
      validatedAccountName: 'Jo***oe',
      nested: { note: 'paid with [REDACTED_PAN]', amount: 500, status: 'PENDING', code: 'X1' },
      list: [{ cvv: '[REDACTED]' }],
      big: '10',
    });
  });
});

describe('redact keeps errors diagnosable', () => {
  it('preserves Error name, message, stack and code while scrubbing card numbers', () => {
    const original = Object.assign(
      new Error('relation "cards" does not exist; card 4242424242424242'),
      { code: '42P01' },
    );
    original.name = 'DatabaseError';
    const output = redact({ err: original }) as { err: Error & { code?: string } };
    expect(output.err).toBeInstanceOf(Error);
    expect(output.err.name).toBe('DatabaseError');
    expect(output.err.message).toBe('relation "cards" does not exist; card [REDACTED_PAN]');
    expect(output.err.code).toBe('42P01');
    expect(output.err.stack).toBeDefined();
  });
});

describe('masking', () => {
  it('masks phone numbers, emails and names', () => {
    expect(maskPhone('+250788123456')).toBe('+250 78* *** 456');
    expect(maskPhone('+14155552671')).toBe('+1415****671');
    expect(maskPhone(null)).toBeNull();
    expect(maskLocalMsisdn('0788123456')).toBe('078* *** 456');
    expect(maskEmail('jean.doe@example.com')).toBe('j***@e***.com');
    expect(maskName('Jean Bosco Uwimana')).toBe('J*** B*** U***');
    expect(firstName('  Jean Bosco ')).toBe('Jean');
  });
});
