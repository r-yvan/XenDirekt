import { MockPaymentProvider } from '../../../src/modules/provider/mock/mock-payment.provider';

describe('mock payment provider', () => {
  async function addCard(mock: MockPaymentProvider, cardKey: string): Promise<string> {
    const setup = await mock.createCardSetup({
      setupRef: 'setup-ref-0001',
      customerCountry: 'US',
      returnUrl: 'xendirekt-app://card-setup/return',
    });
    expect(mock.completeSetup(setup.providerSetupId, cardKey)).not.toBeNull();
    const result = await mock.getCardSetupResult(setup.providerSetupId);
    if (result.status !== 'SUCCEEDED') {
      throw new Error(`setup ${result.status}`);
    }
    return result.card.token;
  }

  it('still recognises a card token after its in-memory state is lost (API restart)', async () => {
    const mock = new MockPaymentProvider('http://localhost:3000');
    const token = await addCard(mock, 'visa-home');
    mock.reset();
    const auth = await mock.authorise({
      requestRef: 'XD-TEST01-AU',
      cardToken: token,
      amountMinor: 854n,
      currency: 'USD',
      requireThreeDs: false,
      returnUrl: 'xendirekt-app://3ds/return',
    });
    expect(auth.status).not.toBe('DECLINED');
  });

  it('declines a token it never issued', async () => {
    const mock = new MockPaymentProvider('http://localhost:3000');
    const auth = await mock.authorise({
      requestRef: 'XD-TEST02-AU',
      cardToken: 'mock_tok.visa-home.not-a-uuid',
      amountMinor: 854n,
      currency: 'USD',
      requireThreeDs: false,
      returnUrl: 'xendirekt-app://3ds/return',
    });
    expect(auth).toMatchObject({ status: 'DECLINED', declineCode: 'INVALID_TOKEN' });
  });
});
