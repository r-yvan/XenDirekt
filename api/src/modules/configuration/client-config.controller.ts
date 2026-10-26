import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { AppConfig } from '../../config/app-config';
import { PIN_LENGTH } from '../auth/domain/pin-policy';
import { OTP_LENGTH, OTP_RESEND_COOLDOWN_MS } from '../auth/otp.service';

/**
 * What the app needs to render correctly before sign-in: whether money is simulated, which
 * optional features exist, legal document versions. Feature flags let the app hide capabilities
 * the backend cannot honour instead of shipping misleading UI.
 */
@ApiTags('app')
@Public()
@Controller('v1/app-config')
export class ClientConfigController {
  constructor(private readonly config: AppConfig) {}

  @Get()
  get() {
    return {
      environment: this.config.environment,
      providerMode: this.config.usesSimulatedProvider ? 'SANDBOX' : 'LIVE',
      features: {
        merchantCodes: this.config.features.merchantCodes,
        federatedSignIn: false,
        identityVerification: false,
        pushNotifications: this.config.notifications.pushTransport !== 'disabled',
        smsSignIn: this.config.notifications.smsTransport !== 'disabled',
        emailSignIn: this.config.notifications.email.transport !== 'disabled',
      },
      auth: {
        otpLength: OTP_LENGTH,
        otpResendSeconds: OTP_RESEND_COOLDOWN_MS / 1000,
        pinLength: PIN_LENGTH,
      },
      legal: {
        termsVersion: this.config.legal.termsVersion,
        privacyVersion: this.config.legal.privacyVersion,
        termsUrl: this.config.legal.termsUrl,
        privacyUrl: this.config.legal.privacyUrl,
      },
      banner: null as null | { kind: 'PROVIDER_DEGRADED'; since: string },
    };
  }
}
