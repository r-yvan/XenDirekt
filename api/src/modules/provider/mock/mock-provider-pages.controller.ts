import { Body, Controller, Get, Inject, NotFoundException, Param, Post, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../../../common/decorators/public.decorator';
import { AppConfig } from '../../../config/app-config';
import { formatMinorAsDecimal } from '../../../shared/money/currency';
import { PAYMENT_PROVIDER, type PaymentProvider } from '../domain/payment-provider';
import { HybridPaymentProvider } from '../hybrid/hybrid-payment.provider';
import { MockPaymentProvider } from './mock-payment.provider';
import { MOCK_CARDS } from './mock-scenarios';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

function page(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
body{font-family:system-ui,sans-serif;background:#000;color:#fff;margin:0;padding:20px}
.banner{background:#F5B83D;color:#000;font-weight:700;padding:8px 12px;border-radius:8px;margin-bottom:16px}
h1{font-size:20px}button{width:100%;padding:14px;margin:6px 0;border-radius:12px;border:0;font-size:16px;text-align:left;background:#1E1E1E;color:#fff}
button.primary{background:#FF640A;color:#000;font-weight:700;text-align:center}button.secondary{text-align:center}
p{color:#A0A0A0}
</style></head><body><div class="banner">SANDBOX: simulated partner page. No real card or money.</div>${body}</body></html>`;
}

/**
 * Stand-ins for the partner-hosted card form and 3-D Secure challenge (local/test/sandbox only).
 * They never ask for a card number: testers pick a scenario. Plain HTML forms, no scripts, so the
 * strict Content-Security-Policy applies unchanged.
 */
@ApiExcludeController()
@Public()
@Controller('dev/mock-provider')
export class MockProviderPagesController {
  constructor(
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
    private readonly config: AppConfig,
  ) {}

  private get mock(): MockPaymentProvider {
    // The hybrid simulates cards with the same mock, so its pages are served too.
    const mock =
      this.provider instanceof MockPaymentProvider
        ? this.provider
        : this.provider instanceof HybridPaymentProvider
          ? this.provider.mock
          : null;
    if (this.config.isProduction || !mock) {
      throw new NotFoundException();
    }
    return mock;
  }

  @Get('card-setup/:setupId')
  cardSetup(@Param('setupId') setupId: string, @Res() res: Response): void {
    if (!this.mock.setupSummary(setupId).open) {
      res.status(410).type('html').send(page('Expired', '<h1>This card setup has expired.</h1>'));
      return;
    }
    const action = `/dev/mock-provider/card-setup/${encodeURIComponent(setupId)}`;
    const buttons = MOCK_CARDS.map(
      (card) =>
        `<form method="post" action="${action}"><input type="hidden" name="cardKey" value="${escapeHtml(card.key)}"><button type="submit">${escapeHtml(card.label)}</button></form>`,
    ).join('');
    res
      .type('html')
      .send(
        page(
          'Add a card',
          `<h1>Choose a test card</h1><p>Each card triggers a documented scenario.</p>${buttons}`,
        ),
      );
  }

  @Post('card-setup/:setupId')
  completeCardSetup(
    @Param('setupId') setupId: string,
    @Body() body: { cardKey?: string },
    @Res() res: Response,
  ): void {
    const redirect = this.mock.completeSetup(setupId, String(body.cardKey ?? ''));
    if (!redirect) {
      res.status(410).type('html').send(page('Expired', '<h1>This card setup has expired.</h1>'));
      return;
    }
    res.redirect(303, redirect);
  }

  @Get('3ds/:authRef')
  threeDs(@Param('authRef') authRef: string, @Res() res: Response): void {
    const summary = this.mock.threeDsSummary(authRef);
    if (!summary.open) {
      res
        .status(410)
        .type('html')
        .send(page('Done', '<h1>This verification is no longer open.</h1>'));
      return;
    }
    const action = `/dev/mock-provider/3ds/${encodeURIComponent(authRef)}`;
    const amount =
      summary.amountMinor === null
        ? ''
        : `<p>Amount held: ${escapeHtml(formatMinorAsDecimal(summary.amountMinor, 'USD'))} (card currency)</p>`;
    res.type('html').send(
      page(
        'Verify payment',
        `<h1>Your bank asks you to confirm this payment</h1>${amount}
<form method="post" action="${action}"><input type="hidden" name="decision" value="approve"><button class="primary" type="submit">Approve</button></form>
<form method="post" action="${action}"><input type="hidden" name="decision" value="decline"><button class="secondary" type="submit">Decline</button></form>`,
      ),
    );
  }

  @Post('3ds/:authRef')
  completeThreeDs(
    @Param('authRef') authRef: string,
    @Body() body: { decision?: string },
    @Res() res: Response,
  ): void {
    const redirect = this.mock.completeThreeDs(authRef, body.decision === 'approve');
    if (!redirect) {
      res
        .status(410)
        .type('html')
        .send(page('Done', '<h1>This verification is no longer open.</h1>'));
      return;
    }
    res.redirect(303, redirect);
  }
}
