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
} from '@/lib/server/bff';

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isSameOrigin(request)) return errorResponse(403, 'FORBIDDEN');
  const access = (await cookies()).get(COOKIES.access)?.value;
  if (access) {
    await callApi('/v1/auth/logout', {
      method: 'POST',
      headers: {
        ...forwardedHeaders(request),
        Authorization: `Bearer ${access}`,
        'X-Device-Id': (await deviceId()).id,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
  }
  const response = new NextResponse(null, { status: 204 });
  clearSessionCookies(response);
  return response;
}
