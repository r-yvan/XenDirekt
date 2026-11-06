import {
  ANSWER_CODES,
  hustlePercentile,
  hustleScore,
  hustleTier,
} from '../../../src/modules/launch/domain/hustle-check';
import {
  firstNameOf,
  generateReferralCode,
  manageToken,
  normaliseEmail,
  REFERRAL_CODE_PATTERN,
  verifyManageToken,
} from '../../../src/modules/launch/domain/waitlist';
import { normaliseStory } from '../../../src/modules/launch/stories.service';

const SECRET = 'unit-test-secret-unit-test-secret-unit-test-secret';
const ENTRY = '6f1c2a54-9a8b-4c1d-8e2f-3a4b5c6d7e8f';

describe('Hustle Check scoring', () => {
  it('scores the calmest answers 0 and the worst 100', () => {
    expect(
      hustleScore({ lastTime: 'SMOOTH', speed: 'SECONDS', fees: 'LOW', checking: 'NEVER' }),
    ).toBe(0);
    expect(
      hustleScore({ lastTime: 'STUCK', speed: 'UNKNOWN', fees: 'UNKNOWN', checking: 'ALWAYS' }),
    ).toBe(100);
  });

  it('stays within 0–100 for every combination and rises with each worse answer', () => {
    for (const lastTime of ANSWER_CODES.lastTime) {
      for (const speed of ANSWER_CODES.speed) {
        for (const fees of ANSWER_CODES.fees) {
          for (const checking of ANSWER_CODES.checking) {
            const score = hustleScore({ lastTime, speed, fees, checking });
            expect(score).toBeGreaterThanOrEqual(0);
            expect(score).toBeLessThanOrEqual(100);
          }
        }
      }
    }
    const base = {
      lastTime: 'DETOUR',
      speed: 'SAME_DAY',
      fees: 'SOME',
      checking: 'SOMETIMES',
    } as const;
    expect(hustleScore({ ...base, checking: 'ALWAYS' })).toBeGreaterThan(hustleScore(base));
    expect(hustleScore({ ...base, lastTime: 'DECLINED' })).toBeGreaterThan(hustleScore(base));
  });

  it('maps scores to tiers at 25, 50 and 75', () => {
    expect([0, 24, 25, 49, 50, 74, 75, 100].map(hustleTier)).toEqual([
      'SMOOTH',
      'SMOOTH',
      'PART_TIME',
      'PART_TIME',
      'CERTIFIED',
      'CERTIFIED',
      'LEGEND',
      'LEGEND',
    ]);
  });

  it('computes a mid-rank percentile and has none for the first response', () => {
    expect(hustlePercentile(0, 0, 0)).toBeNull();
    expect(hustlePercentile(3, 0, 4)).toBe(75);
    expect(hustlePercentile(1, 2, 4)).toBe(50);
    expect(hustlePercentile(0, 1, 1)).toBe(50);
  });
});

describe('waitlist codes and tokens', () => {
  it('generates readable referral codes without look-alike characters', () => {
    for (let index = 0; index < 500; index += 1) {
      const code = generateReferralCode();
      expect(code).toMatch(REFERRAL_CODE_PATTERN);
      expect(code).not.toMatch(/[01ILO]/);
    }
  });

  it('accepts its own manage token and rejects forged, altered or foreign ones', () => {
    const token = manageToken(SECRET, ENTRY);
    expect(verifyManageToken(SECRET, token)).toBe(ENTRY);
    expect(verifyManageToken('another-secret-another-secret-another-secret', token)).toBeNull();
    const flipped = token.slice(0, -1) + (token.endsWith('0') ? '1' : '0');
    expect(verifyManageToken(SECRET, flipped)).toBeNull();
    const otherEntry = '00000000-0000-4000-8000-000000000000';
    expect(verifyManageToken(SECRET, `${otherEntry}.${token.split('.')[1]}`)).toBeNull();
    expect(verifyManageToken(SECRET, 'not-a-token')).toBeNull();
  });

  it('normalises emails and greets by first name only', () => {
    expect(normaliseEmail('  Ana.Silva@Example.COM ')).toBe('ana.silva@example.com');
    expect(firstNameOf('  Ana   Maria Silva ')).toBe('Ana');
    expect(firstNameOf(null)).toBeNull();
    expect(firstNameOf('   ')).toBeNull();
  });
});

describe('Wall of Hustle story normalisation', () => {
  it('scrubs card numbers, control characters and runs of whitespace', () => {
    const story = normaliseStory(
      '  My card   4111 1111 1111 1111 was declined\r\n\r\n\r\n\r\nat a stall.\u0007  ',
    );
    expect(story).toBe('My card [REDACTED_PAN] was declined\n\nat a stall.');
  });

  it('keeps emoji and accented text intact', () => {
    expect(normaliseStory('Ça a pris trois jours 😅 pour arriver.')).toBe(
      'Ça a pris trois jours 😅 pour arriver.',
    );
  });
});
