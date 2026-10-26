import { z } from 'zod';
import type { ConfigKey } from '../../database/schema';

const rwf = z.number().int().min(0).max(100_000_000);
const rate = z.string().regex(/^\d{1,12}(\.\d{1,8})?$/);

export const feeConfigSchema = z
  .object({
    fixedRwf: rwf,
    percentageBps: z.number().int().min(0).max(2_000),
    minFeeRwf: rwf,
    maxFeeRwf: rwf,
  })
  .refine((value) => value.minFeeRwf <= value.maxFeeRwf, 'minFeeRwf must be <= maxFeeRwf');

export const limitsConfigSchema = z
  .object({
    minPaymentRwf: rwf.min(1),
    maxPaymentRwf: rwf.min(1),
    perUserDailyRwf: rwf,
    perCardDailyRwf: rwf,
    perPayeeDailyRwf: rwf,
    perUserTripRwf: rwf,
    tripDays: z.number().int().min(1).max(365),
  })
  .refine(
    (value) => value.minPaymentRwf <= value.maxPaymentRwf,
    'minPaymentRwf must be <= maxPaymentRwf',
  );

export const fxConfigSchema = z.object({
  /** RWF per one major unit of each card currency. */
  rates: z.record(z.string().regex(/^[A-Z]{3}$/), rate),
  spreadBps: z.number().int().min(0).max(2_000),
  roundingMode: z.enum(['CEILING', 'HALF_UP']),
  defaultCardCurrency: z.string().regex(/^[A-Z]{3}$/),
  source: z.string().min(1),
  asOf: z.string().min(1),
});

export const cardRulesSchema = z.object({
  allowedBrands: z.array(z.enum(['VISA', 'MASTERCARD'])).min(1),
  blockedIssuingCountries: z.array(z.string().regex(/^[A-Z]{2}$/)),
  rejectPrepaid: z.boolean(),
  blockedBinPrefixes: z.array(z.string().regex(/^\d{6,8}$/)),
  maxActiveCards: z.number().int().min(1).max(10),
  /** NFR-RSK-04: applied only when the partner returns the data. */
  blockOnCountryMismatch: z.boolean(),
  blockOnNameMismatch: z.boolean(),
});

export const payeeRoutingSchema = z.object({
  /** Two digits after the leading 7 of the national number, e.g. "78" for 078 numbers. */
  mtnPrefixes: z.array(z.string().regex(/^\d{2}$/)).min(1),
  merchantCodeMinLength: z.number().int().min(3).max(12),
  merchantCodeMaxLength: z.number().int().min(3).max(12),
  /** A verified name older than this is looked up again before quoting. */
  lookupMaxAgeMinutes: z.number().int().min(1).max(1440),
});

export type FeeConfig = z.infer<typeof feeConfigSchema>;
export type LimitsConfig = z.infer<typeof limitsConfigSchema>;
export type FxConfig = z.infer<typeof fxConfigSchema>;
export type CardRules = z.infer<typeof cardRulesSchema>;
export type PayeeRouting = z.infer<typeof payeeRoutingSchema>;

export interface ConfigValues {
  FEES: FeeConfig;
  LIMITS: LimitsConfig;
  FX_RATES: FxConfig;
  CARD_RULES: CardRules;
  PAYEE_ROUTING: PayeeRouting;
}

export const CONFIG_SCHEMAS: { [K in ConfigKey]: z.ZodType<ConfigValues[K]> } = {
  FEES: feeConfigSchema,
  LIMITS: limitsConfigSchema,
  FX_RATES: fxConfigSchema,
  CARD_RULES: cardRulesSchema,
  PAYEE_ROUTING: payeeRoutingSchema,
};

/**
 * DEVELOPMENT PLACEHOLDERS. None of these values is approved (docs/open-questions.md OQ-02,
 * OQ-03, OQ-28): they exist so local and sandbox environments work. Production refuses to quote
 * with any unapproved FEES, LIMITS or FX_RATES version.
 */
export const PLACEHOLDER_CONFIG: ConfigValues = {
  FEES: { fixedRwf: 200, percentageBps: 150, minFeeRwf: 200, maxFeeRwf: 5_000 },
  LIMITS: {
    minPaymentRwf: 500,
    maxPaymentRwf: 200_000,
    perUserDailyRwf: 500_000,
    perCardDailyRwf: 500_000,
    perPayeeDailyRwf: 1_000_000,
    perUserTripRwf: 2_000_000,
    tripDays: 30,
  },
  FX_RATES: {
    rates: {
      USD: '1450',
      EUR: '1580',
      GBP: '1840',
      CAD: '1050',
      CHF: '1640',
      JPY: '9.6',
      AUD: '950',
    },
    spreadBps: 0,
    roundingMode: 'CEILING',
    defaultCardCurrency: 'USD',
    source: 'DEV PLACEHOLDER (not a market rate)',
    asOf: '2026-10-26',
  },
  CARD_RULES: {
    allowedBrands: ['VISA', 'MASTERCARD'],
    blockedIssuingCountries: ['RW'],
    rejectPrepaid: true,
    blockedBinPrefixes: [],
    maxActiveCards: 3,
    blockOnCountryMismatch: true,
    blockOnNameMismatch: true,
  },
  PAYEE_ROUTING: {
    mtnPrefixes: ['78', '79'],
    merchantCodeMinLength: 5,
    merchantCodeMaxLength: 8,
    lookupMaxAgeMinutes: 15,
  },
};
