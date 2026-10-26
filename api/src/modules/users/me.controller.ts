import { Body, Controller, Delete, Get, Headers, HttpCode, Ip, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { Kysely } from 'kysely';
import {
  AllowPendingProfile,
  type AuthenticatedUser,
  CurrentUser,
} from '../../common/decorators/auth.decorators';
import { RateLimit } from '../../common/decorators/rate-limit.decorator';
import { InjectDatabase } from '../../database/database.module';
import type { DB } from '../../database/schema';
import { AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import { RegisterDeviceKeyDto, SetPinDto } from '../auth/dto/auth.dto';
import { PinService } from '../auth/pin.service';
import { SessionService } from '../auth/session.service';
import { StepUpService } from '../auth/step-up.service';
import { UpdateProfileDto } from './dto/profile.dto';
import { UsersService } from './users.service';

@ApiTags('me')
@ApiBearerAuth('user')
@AllowPendingProfile()
@Controller('v1/me')
export class MeController {
  constructor(
    private readonly users: UsersService,
    private readonly auth: AuthService,
    private readonly pins: PinService,
    private readonly stepUp: StepUpService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
    @InjectDatabase() private readonly db: Kysely<DB>,
  ) {}

  @Get()
  get(@CurrentUser() user: AuthenticatedUser) {
    return this.users.getProfile(user);
  }

  @Patch()
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: UpdateProfileDto,
    @Headers('accept-language') acceptLanguage: string | undefined,
    @Headers('x-app-version') appVersion: string | undefined,
    @Ip() ip: string,
  ) {
    return this.users.updateProfile(user, body, {
      locale:
        body.preferredLanguage ?? (acceptLanguage?.toLowerCase().startsWith('fr') ? 'fr' : 'en'),
      appVersion: appVersion?.slice(0, 32),
      ip,
    });
  }

  @Delete()
  @HttpCode(204)
  @ApiHeader({ name: 'X-Step-Up-Token', required: true, description: 'purpose DELETE_ACCOUNT' })
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Headers('x-step-up-token') stepUpToken?: string,
  ): Promise<void> {
    await this.users.deleteAccount(user, stepUpToken);
  }

  @Post('pin')
  @HttpCode(204)
  @RateLimit({ name: 'pin-set', key: 'user', limit: 10, windowSeconds: 600 })
  async setPin(@CurrentUser() user: AuthenticatedUser, @Body() body: SetPinDto): Promise<void> {
    await this.pins.setInitial(user.userId, body.pin);
    await this.audit.record({ action: 'auth.pin_set', entityType: 'user', entityId: user.userId });
  }

  @Post('pin/change')
  @HttpCode(204)
  @ApiHeader({ name: 'X-Step-Up-Token', required: true, description: 'purpose CHANGE_PIN' })
  async changePin(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: SetPinDto,
    @Headers('x-step-up-token') stepUpToken?: string,
  ): Promise<void> {
    this.pins.assertPolicy(body.pin);
    await this.db.transaction().execute(async (trx) => {
      await this.stepUp.consume(trx, user, 'CHANGE_PIN', stepUpToken);
      // Other devices must sign in again after a PIN change.
      await this.sessions.revokeAllForUser(user.userId, 'PIN_CHANGED', trx, user.sessionId);
    });
    await this.pins.change(user.userId, body.pin);
    await this.audit.record({
      action: 'auth.pin_changed',
      entityType: 'user',
      entityId: user.userId,
    });
  }

  @Post('device-key')
  @HttpCode(201)
  @ApiHeader({
    name: 'X-Step-Up-Token',
    required: true,
    description: 'purpose REGISTER_DEVICE_KEY (via PIN)',
  })
  registerDeviceKey(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: RegisterDeviceKeyDto,
    @Headers('x-step-up-token') stepUpToken?: string,
  ) {
    return this.auth.registerDeviceKey(user, body.algorithm, body.publicKey, stepUpToken);
  }

  @Delete('device-key')
  @HttpCode(204)
  async revokeDeviceKey(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.auth.revokeDeviceKey(user);
  }
}
