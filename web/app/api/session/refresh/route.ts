import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import {
  COOKIES,
  callApi,
  clearSessionCookies,
  deviceId,
  errorResponse,
  forwardedHeaders,
  isSameOrigin,
  setSessionCookies,
  type TokenPair,
} from '@/lib/server/bff';

/**
 * Rotates the refresh token. The client serialises calls (Web Locks) because the API treats a
 * reused refresh token as theft.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isSameOrigin(request)) return errorResponse(403, 'FORBIDDEN');
  const jar = await cookies();
  const refreshToken = jar.get(COOKIES.refresh)?.value;
  if (!refreshToken) return errorResponse(401, 'SESSION_REVOKED');
  if (jar.get(COOKIES.access)?.value) return NextResponse.json({ refreshed: false });
  const upstream = await callApi('/v1/auth/refresh', {
    method: 'POST',
    headers: { ...forwardedHeaders(request), 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken, deviceId: (await deviceId()).id }),
  });
  if (!upstream.ok) {
    const response = NextResponse.json(await upstream.json().catch(() => ({})), {
      status: upstream.status >= 500 ? upstream.status : 401,
    });
    if (upstream.status < 500) clearSessionCookies(response);
    return response;
  }
  const response = NextResponse.json({ refreshed: true });
  setSessionCookies(response, (await upstream.json()) as TokenPair);
  return response;
}
