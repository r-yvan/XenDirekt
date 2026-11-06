import {
  ProviderOutcomeUnknownError,
  ProviderRejectedError,
  ProviderUnreachableError,
} from '../domain/provider-errors';

/** Error codes that prove the request never reached the provider (safe to retry anything). */
const NOT_SENT_CODES = new Set([
  'ECONNREFUSED',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'UND_ERR_CONNECT_TIMEOUT',
  'CERT_HAS_EXPIRED',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'ERR_TLS_CERT_ALTNAME_INVALID',
]);

/** Walks the error cause chain (undici nests the socket error) for a system error code. */
function causeCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current; depth += 1) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === 'string') {
      return code;
    }
    const nested = (current as { errors?: unknown[] }).errors;
    if (Array.isArray(nested)) {
      const inner = nested.map(causeCode).find((value) => value !== undefined);
      if (inner) {
        return inner;
      }
    }
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

export interface XentriPayHttpOptions {
  baseUrl: string;
  apiKey: string;
  responseTimeoutMs: number;
}

/**
 * Minimal HTTP client for XentriPay (X-XENTRIPAY-KEY auth, XP §3). Classifies every failure so the
 * orchestrator can tell "never sent" from "outcome unknown" from "definitely rejected". The API
 * key is only ever placed in the request header; it is never logged.
 */
export class XentriPayHttpClient {
  constructor(private readonly options: XentriPayHttpOptions) {}

  async request(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ): Promise<{ status: number; json: unknown }> {
    let response: Response;
    try {
      response = await fetch(`${this.options.baseUrl}${path}`, {
        method,
        headers: {
          'X-XENTRIPAY-KEY': this.options.apiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        ...(method === 'POST' && body !== undefined ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(this.options.responseTimeoutMs),
        redirect: 'error',
      });
    } catch (error) {
      const code = causeCode(error);
      if (code && NOT_SENT_CODES.has(code)) {
        throw new ProviderUnreachableError(`XentriPay unreachable (${code})`);
      }
      // Timeouts and resets after the request may have been written: outcome unknown.
      throw new ProviderOutcomeUnknownError(
        `XentriPay ${method} ${path} outcome unknown (${code ?? (error as Error).name})`,
      );
    }

    let json: unknown = null;
    const text = await response.text().catch(() => '');
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
    }
    // Observed in XentriPay's sandbox (2026-11-06, OQ-19): an unknown customerReference is a 500
    // with this message, not a 404. Only this exact message counts as "not found".
    const message500 = (json as { message?: unknown } | null)?.message;
    if (
      response.status === 500 &&
      typeof message500 === 'string' &&
      /^Payment with customerReference not found$/i.test(message500.trim())
    ) {
      return { status: 404, json };
    }
    if (response.status >= 500) {
      throw new ProviderOutcomeUnknownError(
        `XentriPay ${method} ${path} returned ${response.status}`,
      );
    }
    if (response.status === 404) {
      return { status: 404, json };
    }
    if (response.status >= 400) {
      const message = (json as { message?: unknown } | null)?.message;
      throw new ProviderRejectedError(
        `XentriPay rejected ${method} ${path} (${response.status})`,
        typeof message === 'string' ? message.slice(0, 120) : String(response.status),
      );
    }
    return { status: response.status, json };
  }
}
