import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Backend-for-frontend helpers. The XenDirekt API issues bearer tokens to apps; on the web they
 * live only in httpOnly, SameSite=Lax cookies set here, never in JavaScript-readable storage.
 */
export const API_BASE_URL = (process.env.API_BASE_URL ?? 'http://localhost:3000').replace(
  /\/+$/,
  '',
);
const SECURE = process.env.COOKIE_SECURE === 'true';

export const COOKIES = {
  access: 'xd_at',
  refresh: 'xd_rt',
  device: 'xd_did',
} as const;

const REFRESH_MAX_AGE = 30 * 86_400;

export interface TokenPair {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
}

export function errorResponse(status: number, code: string, message?: string): NextResponse {
  return NextResponse.json(
    { error: { code, message: message ?? code, requestId: null } },
    { status },
  );
}

/** Mutating requests must come from this origin (defence in depth on top of SameSite). */
export function isSameOrigin(request: NextRequest): boolean {
  if (request.method === 'GET' || request.method === 'HEAD') return true;
  const site = request.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') return false;
  const origin = request.headers.get('origin');
  if (!origin) return site === 'same-origin';
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Per-browser device ID (the API binds sessions to it). Created on first use. */
export async function deviceId(): Promise<{ id: string; created: boolean }> {
  const jar = await cookies();
  const existing = jar.get(COOKIES.device)?.value;
  if (existing && /^web-[0-9a-f-]{36}$/.test(existing)) return { id: existing, created: false };
  return { id: `web-${randomUUID()}`, created: true };
}

export function setDeviceCookie(response: NextResponse, id: string): void {
  response.cookies.set(COOKIES.device, id, {
    httpOnly: true,
    secure: SECURE,
    sameSite: 'lax',
    path: '/',
    maxAge: 2 * 365 * 86_400,
  });
}

export function setSessionCookies(response: NextResponse, tokens: TokenPair): void {
  response.cookies.set(COOKIES.access, tokens.accessToken, {
    httpOnly: true,
    secure: SECURE,
    sameSite: 'lax',
    path: '/',
    // Expire a little early so the proxy never forwards a token the API is about to reject.
    maxAge: Math.max(30, tokens.accessTokenExpiresIn - 30),
  });
  response.cookies.set(COOKIES.refresh, tokens.refreshToken, {
    httpOnly: true,
    secure: SECURE,
    sameSite: 'lax',
    path: '/',
    maxAge: REFRESH_MAX_AGE,
  });
}

export function clearSessionCookies(response: NextResponse): void {
  for (const name of [COOKIES.access, COOKIES.refresh]) {
    response.cookies.set(name, '', { httpOnly: true, secure: SECURE, path: '/', maxAge: 0 });
  }
}

/** Headers forwarded to the API: client IP (for per-IP limits), language, request ID. */
export function forwardedHeaders(request: NextRequest): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Request-Id': request.headers.get('x-request-id') ?? randomUUID(),
  };
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (ip) headers['X-Forwarded-For'] = ip;
  const language = request.headers.get('accept-language');
  if (language) headers['Accept-Language'] = language;
  const agent = request.headers.get('user-agent');
  if (agent) headers['User-Agent'] = agent.slice(0, 200);
  return headers;
}

export async function callApi(
  path: string,
  init: { method: string; headers: Record<string, string>; body?: string },
): Promise<Response> {
  try {
    return await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      cache: 'no-store',
      redirect: 'manual',
    });
  } catch {
    return new Response(
      JSON.stringify({
        error: { code: 'PROVIDER_UNAVAILABLE', message: 'The XenDirekt API is unreachable.' },
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
