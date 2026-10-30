import { z } from 'zod';

/**
 * PRD §10.1 events. Only these names and these properties are accepted: no names, phone numbers,
 * emails, card data or free text, ever. Internal IDs are attached server-side.
 */
const ms = z.number().int().min(0).max(3_600_000);
const small = z.string().regex(/^[A-Za-z0-9_.:-]{1,40}$/);

export const ANALYTICS_EVENTS = {
  app_installed: z.object({
    language: z.enum(['en', 'fr']).optional(),
    platform: z.enum(['ios', 'android']).optional(),
  }),
  signup_started: z.object({ method: z.enum(['EMAIL', 'SMS']).optional() }),
  signup_completed: z.object({
    country: z
      .string()
      .regex(/^[A-Z]{2}$/)
      .optional(),
  }),
  card_added: z.object({ brand: small.optional() }),
  card_add_failed: z.object({ reason: small.optional() }),
  payee_lookup_succeeded: z.object({ latencyMs: ms.optional() }),
  payee_lookup_failed: z.object({ reason: small.optional(), latencyMs: ms.optional() }),
  quote_shown: z.object({
    amountRwf: z.number().int().min(0).max(100_000_000).optional(),
    cardCurrency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .optional(),
  }),
  payment_confirmed: z.object({ amountRwf: z.number().int().min(0).max(100_000_000).optional() }),
  pay_screen_opened: z.object({}),
  ticket_created: z.object({ category: small.optional() }),
  taps_to_complete: z.object({ flow: small, taps: z.number().int().min(0).max(50) }),
} as const;

export type AnalyticsEventName = keyof typeof ANALYTICS_EVENTS;

export const analyticsBatchSchema = z.object({
  events: z
    .array(
      z.object({
        name: z.string(),
        occurredAt: z.iso.datetime(),
        properties: z.record(z.string(), z.unknown()).default({}),
      }),
    )
    .min(1)
    .max(50),
});
