import { NextResponse, type NextRequest } from 'next/server';
import {
  callApi,
  deviceId,
  errorResponse,
  forwardedHeaders,
  isSameOrigin,
  setDeviceCookie,
  setSessionCookies,
  type TokenPair,
} from '@/lib/server/bff';

/** Verifies the one-time code and keeps the resulting tokens in httpOnly cookies. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isSameOrigin(request)) return errorResponse(403, 'FORBIDDEN');
  const input = (await request.json().catch(() => ({}))) as {
    challengeId?: unknown;
    otp?: unknown;
  };
  const device = await deviceId();
  const upstream = await callApi('/v1/auth/verify', {
    method: 'POST',
    headers: { ...forwardedHeaders(request), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      challengeId: input.challengeId,
      otp: input.otp,
      deviceId: device.id,
      platform: 'web',
      appVersion: 'web-0.1.0',
    }),
  });
  const body = (await upstream.json()) as TokenPair & { user?: unknown; isNewUser?: boolean };
  if (!upstream.ok) {
    const response = NextResponse.json(body, { status: upstream.status });
    if (device.created) setDeviceCookie(response, device.id);
    return response;
  }
  const response = NextResponse.json({ user: body.user, isNewUser: body.isNewUser });
  setSessionCookies(response, body);
  if (device.created) setDeviceCookie(response, device.id);
  return response;
}
