'use client';

/** Browser API client: everything goes through this origin's /api/xd proxy. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

let refreshing: Promise<boolean> | null = null;

/** One refresh at a time, across tabs too: the API revokes a session on refresh-token reuse. */
export function refreshSession(): Promise<boolean> {
  if (!refreshing) {
    const run = async () => {
      const response = await fetch('/api/session/refresh', { method: 'POST' });
      return response.ok;
    };
    const locked =
      typeof navigator !== 'undefined' && 'locks' in navigator
        ? navigator.locks.request('xd-session-refresh', run)
        : run();
    refreshing = Promise.resolve(locked).finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

export const SIGNED_OUT_EVENT = 'xd:signed-out';

async function parse(response: Response): Promise<unknown> {
  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export async function api<T>(
  path: string,
  init: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<T> {
  const send = () =>
    fetch(`/api/xd/${path.replace(/^\//, '')}`, {
      method: init.method ?? 'GET',
      headers: { 'Content-Type': 'application/json', ...init.headers },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  let response = await send();
  if (response.status === 401) {
    const body = (await parse(response.clone()).catch(() => null)) as {
      error?: { code?: string };
    } | null;
    if (body?.error?.code === 'UNAUTHENTICATED' && (await refreshSession())) {
      response = await send();
    }
  }
  const body = (await parse(response).catch(() => null)) as
    (T & { error?: { code: string; message: string; details?: Record<string, unknown> } }) | null;
  if (!response.ok) {
    const error = body?.error;
    const code = error?.code ?? 'INTERNAL_ERROR';
    if (response.status === 401 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(SIGNED_OUT_EVENT));
    }
    throw new ApiError(response.status, code, messageFor(code, error?.details), error?.details);
  }
  return body as T;
}

/** The API's stable error codes, as people should read them. Never shows raw server text. */
export function messageFor(code: string, details?: Record<string, unknown>): string {
  const retry = details?.retryAfterSeconds;
  const messages: Record<string, string> = {
    VALIDATION_FAILED: 'Some details don’t look right. Check them and try again.',
    OTP_INVALID: 'That code isn’t right. Check the email and try again.',
    OTP_EXPIRED: 'That code has expired. Send yourself a new one.',
    OTP_ATTEMPTS_EXCEEDED: 'Too many tries. Send yourself a new code.',
    INVALID_PAYEE_IDENTIFIER: 'Enter an MTN MoMo number, like 078 812 3456.',
    UNAUTHENTICATED: 'Please sign in again.',
    SESSION_REVOKED: 'Your session ended. Please sign in again.',
    PIN_INVALID: 'Wrong PIN. Try again.',
    PIN_LOCKED: 'Too many wrong PINs. Wait a few minutes and try again.',
    STEP_UP_REQUIRED: 'Confirm with your PIN to continue.',
    ACCOUNT_BLOCKED: 'This account is blocked. Contact support.',
    NOT_FOUND: 'We couldn’t find that.',
    CONFLICT: 'That can’t be changed now.',
    PROFILE_INCOMPLETE: 'Finish your profile first.',
    CARD_LIMIT_REACHED: 'You already have the maximum number of cards.',
    CARD_NOT_ACTIVE: 'This card can’t be used. Try another card.',
    CARD_SETUP_INCOMPLETE: 'The card wasn’t added yet. Finish the card page and try again.',
    CARD_SETUP_FAILED: 'The card couldn’t be added. Try again or use another card.',
    CARD_NOT_ELIGIBLE: 'This card isn’t supported. Use a Visa or Mastercard issued outside Rwanda.',
    QUOTE_EXPIRED: 'The price expired. We’ve fetched a fresh one.',
    QUOTE_ALREADY_USED: 'This price was already used. Start the payment again.',
    PAYMENT_ALREADY_IN_PROGRESS: 'A payment to this account is already in progress.',
    PAYEE_NOT_FOUND:
      'We couldn’t find this MoMo account. Check the number with the person you’re paying.',
    PAYEE_INACTIVE: 'This MoMo account can’t receive payments right now.',
    PAYEE_BLOCKED: 'Payments to this account aren’t possible.',
    NETWORK_NOT_SUPPORTED: 'Only MTN MoMo numbers are supported for now.',
    AMOUNT_OUT_OF_RANGE: 'That amount is outside the allowed range.',
    LIMIT_EXCEEDED: 'This payment is over your limit for now.',
    FEATURE_DISABLED: 'That isn’t available yet.',
    RATE_LIMITED:
      typeof retry === 'number'
        ? `Too many attempts. Try again in ${Math.ceil(retry / 60)} min.`
        : 'Too many attempts. Try again a little later.',
    PAYMENTS_PAUSED: 'Payments are paused for a moment. Please try again soon.',
    PROVIDER_UNAVAILABLE: 'We can’t reach our servers. Check your connection and try again.',
    CAPABILITY_NOT_CONFIGURED: 'This isn’t available yet.',
    FORBIDDEN: 'That isn’t allowed.',
  };
  return messages[code] ?? 'Something went wrong. Please try again.';
}
