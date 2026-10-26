import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AllowPendingProfile,
  type AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/auth.decorators';
import { Public } from '../../common/decorators/public.decorator';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { AppError } from '../../common/errors/app-error';
import { normaliseLocale } from '../notifications/templates/otp.template';
import { AuthService } from './auth.service';
import {
  RefreshDto,
  RequestOtpDto,
  SetPinDto,
  StepUpChallengeDto,
  StepUpDto,
  VerifyOtpDto,
} from './dto/auth.dto';
import { PinService } from './pin.service';
import { OtpService } from './otp.service';
import { SessionService } from './session.service';
import { StepUpService } from './step-up.service';

@ApiTags('auth')
@Controller('v1/auth')
export class AuthController {
  constructor(
    private readonly otp: OtpService,
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    private readonly stepUp: StepUpService,
    private readonly pins: PinService,
  ) {}

  @Public()
  @Post('otp')
  @HttpCode(202)
  @ApiOperation({
    summary: 'Send a 6-digit one-time code (same response whether or not an account exists)',
  })
  @RateLimit(
    { name: 'otp-destination', key: 'body:destination', limit: 5, windowSeconds: 3600 },
    { name: 'otp-ip', key: 'ip', limit: 20, windowSeconds: 3600 },
    { name: 'otp-device', key: 'device', limit: 10, windowSeconds: 3600 },
  )
  requestOtp(
    @Body() body: RequestOtpDto,
    @Headers('accept-language') acceptLanguage?: string,
    @Headers('x-device-id') deviceId?: string,
  ) {
    return this.otp.request({
      channel: body.channel,
      destination: body.destination,
      locale: body.locale ?? normaliseLocale(acceptLanguage),
      deviceIdHash: deviceId ? this.sessions.hashDeviceId(deviceId) : null,
    });
  }

  @Public()
  @Post('verify')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Verify the code; returns access + refresh tokens bound to this device',
  })
  @RateLimit({ name: 'otp-verify-ip', key: 'ip', limit: 30, windowSeconds: 600 })
  verify(@Body() body: VerifyOtpDto) {
    return this.auth.verifyOtpAndSignIn(body.challengeId, body.otp, {
      deviceId: body.deviceId,
      platform: body.platform,
      appVersion: body.appVersion,
    });
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotate the refresh token (single use; reuse revokes the session)' })
  @RateLimit({ name: 'refresh-ip', key: 'ip', limit: 60, windowSeconds: 600 })
  refresh(@Body() body: RefreshDto) {
    return this.sessions.refresh(body.refreshToken, body.deviceId);
  }

  @Post('logout')
  @HttpCode(204)
  @AllowPendingProfile()
  @ApiBearerAuth('user')
  async logout(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.auth.logout(user);
  }

  @Post('pin/verify')
  @HttpCode(204)
  @AllowPendingProfile()
  @ApiBearerAuth('user')
  @ApiOperation({ summary: 'Check the PIN (app unlock fallback); same lockout as step-up' })
  @RateLimit({ name: 'pin-verify', key: 'user', limit: 20, windowSeconds: 600 })
  async verifyPin(@CurrentUser() user: AuthenticatedUser, @Body() body: SetPinDto): Promise<void> {
    await this.pins.verify(user.userId, body.pin);
  }

  @Post('step-up/challenge')
  @HttpCode(201)
  @AllowPendingProfile()
  @ApiBearerAuth('user')
  @ApiOperation({ summary: 'Nonce for a biometric (device-key) step-up' })
  @RateLimit({ name: 'step-up-challenge', key: 'user', limit: 30, windowSeconds: 600 })
  challenge(@CurrentUser() user: AuthenticatedUser, @Body() body: StepUpChallengeDto) {
    return this.stepUp.createChallenge(user, body.purpose);
  }

  @Post('step-up')
  @HttpCode(201)
  @AllowPendingProfile()
  @ApiBearerAuth('user')
  @ApiOperation({
    summary: 'Exchange PIN or device-key signature for a single-use 2-minute step-up token',
  })
  @RateLimit({ name: 'step-up', key: 'user', limit: 20, windowSeconds: 600 })
  grant(@CurrentUser() user: AuthenticatedUser, @Body() body: StepUpDto) {
    if (body.method === 'PIN') {
      if (!body.pin) {
        throw new AppError('VALIDATION_FAILED', undefined, {
          fields: ['pin: required for method PIN'],
        });
      }
      return this.stepUp.grantWithPin(user, body.purpose, body.pin);
    }
    if (!body.challengeId || !body.signature) {
      throw new AppError('VALIDATION_FAILED', undefined, {
        fields: ['challengeId and signature: required for method DEVICE_KEY'],
      });
    }
    return this.stepUp.grantWithDeviceKey(user, body.purpose, body.challengeId, body.signature);
  }
}
