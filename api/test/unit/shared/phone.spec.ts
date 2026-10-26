import {
  normaliseInternationalPhone,
  normaliseMerchantCode,
  parseRwandaMsisdn,
} from '../../../src/shared/phone/phone';

describe('parseRwandaMsisdn', () => {
  it.each([
    '0788123456',
    '788123456',
    '+250788123456',
    '250788123456',
    '00250788123456',
    '+250 788 123 456',
    '078-812-3456',
    '(078) 812.3456',
  ])('normalises %p', (input) => {
    expect(parseRwandaMsisdn(input)).toEqual({
      e164: '+250788123456',
      local: '0788123456',
      display: '078 812 3456',
      prefix: '78',
    });
  });

  it.each([
    '',
    '078812345', // too short
    '07881234567', // too long
    '0688123456', // not a 7-series mobile number
    '+256788123456', // Uganda
    '25078812345',
    'abc0788123456',
    '+2507881234+56',
  ])('rejects %p', (input) => {
    expect(parseRwandaMsisdn(input)).toBeNull();
  });

  it('keeps the network prefix for routing', () => {
    expect(parseRwandaMsisdn('0791234567')?.prefix).toBe('79');
    expect(parseRwandaMsisdn('0721234567')?.prefix).toBe('72');
  });
});

describe('normaliseInternationalPhone', () => {
  it('accepts valid E.164 numbers with formatting', () => {
    expect(normaliseInternationalPhone('+1 415 555 2671')).toBe('+14155552671');
    expect(normaliseInternationalPhone('+44 20 7946 0958')).toBe('+442079460958');
  });

  it('requires a leading plus and a valid number', () => {
    expect(normaliseInternationalPhone('4155552671')).toBeNull();
    expect(normaliseInternationalPhone('+1 000')).toBeNull();
    expect(normaliseInternationalPhone('+not-a-phone')).toBeNull();
  });
});

describe('normaliseMerchantCode', () => {
  it('accepts digit-only codes within the configured length', () => {
    expect(normaliseMerchantCode('123 456')).toBe('123456');
    expect(normaliseMerchantCode('1234')).toBeNull();
    expect(normaliseMerchantCode('123456789')).toBeNull();
    expect(normaliseMerchantCode('12A456')).toBeNull();
  });
});
