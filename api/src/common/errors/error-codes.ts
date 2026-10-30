/**
 * Stable, machine-readable error codes. Clients branch on `code`, never on `message`.
 * Messages are safe defaults in English; the app shows its own localised text per code.
 * Adding a code is backwards compatible; renaming or removing one is a breaking API change.
 */
export const ERROR_DEFINITIONS = {
  VALIDATION_FAILED: { status: 400, message: 'The request is invalid.' },
  UNAUTHENTICATED: { status: 401, message: 'Sign in to continue.' },
  FORBIDDEN: { status: 403, message: 'You are not allowed to do this.' },
  NOT_FOUND: { status: 404, message: 'Not found.' },
  CONFLICT: { status: 409, message: 'The request conflicts with the current state.' },
  RATE_LIMITED: { status: 429, message: 'Too many attempts. Please wait and try again.' },
  INTERNAL_ERROR: { status: 500, message: 'Something went wrong on our side.' },

  IDEMPOTENCY_KEY_REQUIRED: { status: 400, message: 'An Idempotency-Key header is required.' },
  IDEMPOTENCY_KEY_REUSED: {
    status: 409,
    message: 'This Idempotency-Key was already used for a different request.',
  },

  OTP_INVALID: { status: 400, message: 'That code is not correct.' },
  OTP_EXPIRED: { status: 400, message: 'That code has expired. Request a new one.' },
  OTP_ATTEMPTS_EXCEEDED: { status: 400, message: 'Too many wrong codes. Request a new one.' },
  PIN_INVALID: { status: 401, message: 'That PIN is not correct.' },
  PIN_LOCKED: { status: 423, message: 'PIN entry is locked for a while after too many attempts.' },
  PIN_NOT_SET: { status: 409, message: 'Set a PIN first.' },
  STEP_UP_REQUIRED: { status: 401, message: 'Confirm it is you to continue.' },
  SESSION_REVOKED: { status: 401, message: 'Your session has ended. Sign in again.' },
  PROFILE_INCOMPLETE: { status: 409, message: 'Complete your profile first.' },
  ACCOUNT_BLOCKED: { status: 403, message: 'This account is blocked. Contact support.' },
  INVALID_CREDENTIALS: { status: 401, message: 'Email, password or code is not correct.' },
  ADMIN_TOTP_REQUIRED: { status: 401, message: 'Enter your authenticator code.' },
  MAKER_CHECKER_VIOLATION: {
    status: 403,
    message: 'A different administrator must approve this action.',
  },

  CARD_NOT_ELIGIBLE: { status: 422, message: 'This card cannot be used with XenDirekt.' },
  CARD_LIMIT_REACHED: { status: 409, message: 'You can save up to 3 cards.' },
  CARD_NOT_ACTIVE: { status: 409, message: 'This card is not active.' },
  CARD_SETUP_INCOMPLETE: { status: 409, message: 'Card setup is not finished yet.' },
  CARD_SETUP_FAILED: { status: 422, message: 'We could not add this card.' },

  INVALID_PAYEE_IDENTIFIER: { status: 400, message: 'Enter a valid Rwandan MoMo number.' },
  NETWORK_NOT_SUPPORTED: {
    status: 422,
    message: 'XenDirekt currently supports MTN MoMo numbers only.',
  },
  PAYEE_NOT_FOUND: {
    status: 422,
    message: "We couldn't find this MoMo account. Check the number with the seller.",
  },
  PAYEE_INACTIVE: {
    status: 422,
    message: "We couldn't find this MoMo account. Check the number with the seller.",
  },
  PAYEE_BLOCKED: { status: 422, message: 'Payments to this account are not available.' },
  FEATURE_DISABLED: { status: 422, message: 'This feature is not available.' },

  AMOUNT_OUT_OF_RANGE: { status: 422, message: 'The amount is outside the allowed range.' },
  LIMIT_EXCEEDED: {
    status: 422,
    message: 'This payment is above your limit. Verify your identity to raise it.',
  },
  QUOTE_EXPIRED: { status: 409, message: 'The price was updated. Please confirm the new total.' },
  QUOTE_ALREADY_USED: { status: 409, message: 'This quote was already used for a payment.' },
  PAYMENT_ALREADY_IN_PROGRESS: { status: 409, message: 'A payment is already in progress.' },
  PAYMENT_PENDING_REVIEW: {
    status: 409,
    message: "Your payment is being checked. We'll notify you within 30 minutes.",
  },
  PAYMENT_STATE_CONFLICT: {
    status: 409,
    message: 'This action is not possible in the current payment state.',
  },
  REFUND_NOT_ALLOWED: { status: 409, message: 'This payment cannot be refunded.' },

  PAYMENTS_PAUSED: {
    status: 503,
    message:
      'Payments are paused for a moment. You have not been charged. Please try again shortly.',
  },
  PROVIDER_UNAVAILABLE: {
    status: 503,
    message: 'Our payment partner is not responding. Please try again shortly.',
  },
  CAPABILITY_NOT_CONFIGURED: {
    status: 503,
    message: 'This payment capability is not available yet.',
  },
  CONFIGURATION_NOT_APPROVED: {
    status: 503,
    message: 'Payments are not available yet.',
  },
  WEBHOOK_REJECTED: { status: 401, message: 'Event rejected.' },
} as const satisfies Record<string, { status: number; message: string }>;

export type ErrorCode = keyof typeof ERROR_DEFINITIONS;
