import { createServer, IncomingMessage, Server, ServerResponse } from 'node:http';
import { AddressInfo } from 'node:net';
import {
  ProviderOutcomeUnknownError,
  ProviderRejectedError,
  ProviderUnreachableError,
  CapabilityNotConfiguredError,
} from '../../src/modules/provider/domain/provider-errors';
import { XentriPayHttpClient } from '../../src/modules/provider/xentripay/xentripay-http.client';
import { mapPayoutStatus } from '../../src/modules/provider/xentripay/xentripay.mapping';
import { XentriPayPaymentProvider } from '../../src/modules/provider/xentripay/xentripay-payment.provider';

/**
 * Contract tests against payloads copied from the XentriPay documentation v1.0.0 (§5.2, §5.3).
 * Sandbox tests with real credentials are pending (docs/provider-capability-matrix.md row 21).
 */
const DOC_PAYOUT_RESPONSE = {
  id: 2812,
  businessName: 'Acme Business Ltd',
  customerReference: 'XD-7F3K9Q-PO1',
  telecomProvider: 'MTN MOBILE MONEY',
  telecomProviderId: '63510',
  msisdn: '0788302208',
  transactionType: 'PAYOUT',
  currency: 'RWF',
  amount: 500.0,
  txnCharge: 10.0,
  status: 'PENDING',
  statusMessage: 'Payment request submitted to eKash successfully, awaiting confirmation.',
  internalRef: 'Ref42FCC70F46DD',
  remoteIp: '60.108.66.235',
  paymentChanel: 'EKASH',
  validatedAccountName: 'John Doe',
  externalTransactionRef: null,
  createdAt: '2025-07-20T06:51:44.404271908',
  updatedAt: '2025-07-20T06:51:44.404274362',
};

type Handler = (req: IncomingMessage, body: string, res: ServerResponse) => void;

describe('XentriPay adapter (contract)', () => {
  let server: Server;
  let baseUrl: string;
  let handler: Handler;
  let lastRequest:
    | { method?: string; url?: string; headers: IncomingMessage['headers']; body: string }
    | undefined;

  beforeAll(async () => {
    server = createServer((req, res) => {
      let body = '';
      req.on('data', (chunk: Buffer) => (body += chunk.toString()));
      req.on('end', () => {
        lastRequest = { method: req.method, url: req.url, headers: req.headers, body };
        handler(req, body, res);
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const provider = (timeoutMs = 2_000) =>
    new XentriPayPaymentProvider(
      new XentriPayHttpClient({
        baseUrl,
        apiKey: 'test-key-not-real',
        responseTimeoutMs: timeoutMs,
      }),
    );

  const json = (res: ServerResponse, status: number, body: unknown) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  };

  const payoutRequest = {
    requestRef: 'XD-7F3K9Q-PO1',
    payee: {
      network: 'MTN' as const,
      identifierType: 'PHONE' as const,
      identifier: '+250788302208',
    },
    localMsisdn: '0788302208',
    recipientName: 'John Doe',
    amountRwf: 500n,
  };

  it('sends the documented payout request and maps PENDING as not-yet-final', async () => {
    handler = (_req, _body, res) => json(res, 200, DOC_PAYOUT_RESPONSE);
    const result = await provider().payout(payoutRequest);
    expect(result).toEqual({ status: 'PENDING', providerRef: 'Ref42FCC70F46DD', raw: 'PENDING' });
    expect(lastRequest?.method).toBe('POST');
    expect(lastRequest?.url).toBe('/api/payment-requests');
    expect(lastRequest?.headers['x-xentripay-key']).toBe('test-key-not-real');
    expect(JSON.parse(lastRequest?.body ?? '{}')).toEqual({
      customerReference: 'XD-7F3K9Q-PO1',
      telecomProviderId: '63510',
      msisdn: '0788302208',
      name: 'John Doe',
      transactionType: 'PAYOUT',
      currency: 'RWF',
      amount: 500,
    });
  });

  it('reads the documented status response', async () => {
    handler = (_req, _body, res) =>
      json(res, 200, {
        timestamp: '2025-07-22 10:42:52',
        message: 'Success',
        data: { status: 'COMPLETED', reference_number: '00461025533065', amount: '500.0' },
      });
    expect(await provider().getPayoutStatus('XD-7F3K9Q-PO1')).toEqual({
      status: 'SUCCEEDED',
      providerRef: '00461025533065',
      raw: 'COMPLETED',
    });
    expect(lastRequest?.url).toBe('/api/payment-requests/check-status?customerRef=XD-7F3K9Q-PO1');
  });

  it('never treats "message: Success" as payout success', async () => {
    handler = (_req, _body, res) =>
      json(res, 200, { message: 'Success', data: { status: 'PENDING' } });
    expect((await provider().getPayoutStatus('X')).status).toBe('PENDING');
  });

  it.each([
    ['PENDING', 'PENDING'],
    ['COMPLETED', 'SUCCEEDED'],
    ['SUCCESSFUL', 'SUCCEEDED'],
    ['FAILED', 'FAILED'],
    ['REVERSED', 'REVERSED'],
    ['completed', 'SUCCEEDED'],
    ['PROCESSING', 'UNKNOWN'],
    ['', 'UNKNOWN'],
  ])('maps provider status %p to %p', (raw, expected) => {
    expect(mapPayoutStatus(raw, null).status).toBe(expected);
  });

  it('classifies a 5xx and an unreadable 2xx as outcome-unknown (never resend)', async () => {
    handler = (_req, _body, res) => json(res, 502, { error: 'bad gateway' });
    await expect(provider().payout(payoutRequest)).rejects.toBeInstanceOf(
      ProviderOutcomeUnknownError,
    );
    handler = (_req, _body, res) => json(res, 200, { unexpected: true });
    await expect(provider().payout(payoutRequest)).rejects.toBeInstanceOf(
      ProviderOutcomeUnknownError,
    );
  });

  it('classifies a response timeout as outcome-unknown', async () => {
    handler = () => undefined; // never answers
    await expect(provider(300).payout(payoutRequest)).rejects.toBeInstanceOf(
      ProviderOutcomeUnknownError,
    );
  });

  it('classifies documented 400 validation errors and 401 as definite rejections', async () => {
    handler = (_req, _body, res) =>
      json(res, 400, { message: 'Amount must be at least 100 RWF', status: 400 });
    await expect(provider().payout(payoutRequest)).rejects.toBeInstanceOf(ProviderRejectedError);
    handler = (_req, _body, res) =>
      json(res, 401, { status: 401, message: 'Invalid or disabled API key' });
    await expect(provider().payout(payoutRequest)).rejects.toBeInstanceOf(ProviderRejectedError);
  });

  it('classifies a refused connection as never-sent (safe to retry)', async () => {
    const probe = createServer();
    await new Promise<void>((resolve) => probe.listen(0, '127.0.0.1', resolve));
    const port = (probe.address() as AddressInfo).port;
    await new Promise<void>((resolve) => probe.close(() => resolve()));
    const closed = new XentriPayPaymentProvider(
      new XentriPayHttpClient({
        baseUrl: `http://127.0.0.1:${port}`,
        apiKey: 'k',
        responseTimeoutMs: 1_000,
      }),
    );
    await expect(closed.getPayoutStatus('X')).rejects.toBeInstanceOf(ProviderUnreachableError);
  });

  it('maps 404 on status to NOT_FOUND (ambiguous, handled by the orchestrator)', async () => {
    handler = (_req, _body, res) => json(res, 404, { message: 'Not found' });
    expect(await provider().getPayoutStatus('X')).toEqual({ status: 'NOT_FOUND' });
  });

  it('maps the sandbox\'s "customerReference not found" 500 to NOT_FOUND, other 500s stay unknown', async () => {
    // Observed against merchant.test.xentripay.com on 2026-11-06.
    handler = (_req, _body, res) =>
      json(res, 500, { message: 'Payment with customerReference not found', status: 500 });
    expect(await provider().getPayoutStatus('X')).toEqual({ status: 'NOT_FOUND' });
    handler = (_req, _body, res) => json(res, 500, { message: 'Internal error', status: 500 });
    await expect(provider().getPayoutStatus('X')).rejects.toBeInstanceOf(
      ProviderOutcomeUnknownError,
    );
  });

  it('refuses every undocumented capability instead of simulating it', async () => {
    const adapter = provider();
    await expect(adapter.lookupPayee()).rejects.toBeInstanceOf(CapabilityNotConfiguredError);
    await expect(adapter.authorise()).rejects.toBeInstanceOf(CapabilityNotConfiguredError);
    await expect(adapter.capture()).rejects.toBeInstanceOf(CapabilityNotConfiguredError);
    await expect(adapter.void()).rejects.toBeInstanceOf(CapabilityNotConfiguredError);
    await expect(adapter.refund()).rejects.toBeInstanceOf(CapabilityNotConfiguredError);
    await expect(adapter.createCardSetup()).rejects.toBeInstanceOf(CapabilityNotConfiguredError);
    await expect(
      adapter.payout({
        ...payoutRequest,
        payee: { ...payoutRequest.payee, identifierType: 'MERCHANT_CODE' },
        localMsisdn: null,
      }),
    ).rejects.toBeInstanceOf(CapabilityNotConfiguredError);
    expect([...adapter.implemented].sort()).toEqual(['PAYOUT_MTN_PHONE', 'PAYOUT_STATUS']);
  });
});
