import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import {
  COOKIES,
  callApi,
  deviceId,
  errorResponse,
  forwardedHeaders,
  isSameOrigin,
  setDeviceCookie,
} from '@/lib/server/bff';

/**
 * Same-origin proxy to the XenDirekt API for the website and the portal. Only tourist-facing
 * routes are reachable; admin, webhook and development routes are not. Sign-in, refresh and
 * sign-out go through /api/session so tokens never reach JavaScript.
 */
const PUBLIC_ROUTES: [string, RegExp][] = [
  ['GET', /^v1\/app-config$/],
  ['POST', /^v1\/auth\/otp$/],
  ['POST', /^v1\/launch\/waitlist$/],
  ['GET', /^v1\/launch\/waitlist\/[A-Za-z0-9]{1,16}$/],
  ['POST', /^v1\/launch\/waitlist\/leave$/],
  ['POST', /^v1\/launch\/hustle-check$/],
  ['GET', /^v1\/launch\/stories$/],
  ['POST', /^v1\/launch\/stories$/],
  ['GET', /^v1\/launch\/stats$/],
];

const USER_ROUTES: RegExp[] = [
  /^v1\/me(\/pin(\/change)?)?$/,
  /^v1\/auth\/pin\/verify$/,
  /^v1\/auth\/step-up$/,
  /^v1\/cards(\/setup|\/[0-9a-f-]{36})?$/,
  /^v1\/payees\/(lookup|recent)$/,
  /^v1\/quotes$/,
  /^v1\/payments(\/[0-9a-f-]{36}(\/tickets)?)?$/,
  /^v1\/tickets$/,
  /^v1\/notifications(\/[0-9a-f-]{36}\/read)?$/,
];

const FORWARDED_REQUEST_HEADERS = ['content-type', 'idempotency-key', 'x-step-up-token'];
const FORWARDED_RESPONSE_HEADERS = ['content-type', 'retry-after', 'x-request-id'];

async function handle(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  if (!isSameOrigin(request)) return errorResponse(403, 'FORBIDDEN');
  const path = (await context.params).path.join('/');
  const isPublic = PUBLIC_ROUTES.some(([method, re]) => method === request.method && re.test(path));
  const isUser = !isPublic && USER_ROUTES.some((re) => re.test(path));
  if (!isPublic && !isUser) return errorResponse(404, 'NOT_FOUND');

  const headers = forwardedHeaders(request);
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers[name] = value;
  }
  const device = await deviceId();
  headers['X-Device-Id'] = device.id;
  if (isUser) {
    const access = (await cookies()).get(COOKIES.access)?.value;
    // No (or expired) access token: the client refreshes through /api/session and retries.
    if (!access) return errorResponse(401, 'UNAUTHENTICATED');
    headers.Authorization = `Bearer ${access}`;
  }
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const body = hasBody ? await request.text() : undefined;
  if (hasBody && !headers['content-type']) headers['content-type'] = 'application/json';

  const upstream = await callApi(`/${path}${request.nextUrl.search}`, {
    method: request.method,
    headers,
    body: body && body.length > 0 ? body : hasBody ? '{}' : undefined,
  });
  const response = new NextResponse(upstream.status === 204 ? null : await upstream.arrayBuffer(), {
    status: upstream.status,
  });
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) response.headers.set(name, value);
  }
  response.headers.set('Cache-Control', 'no-store');
  if (device.created) setDeviceCookie(response, device.id);
  return response;
}

export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
