import { Module } from '@nestjs/common';
import { ConsentsModule } from '../consents/consents.module';
import { AccountDeletionHooks } from '../users/account-deletion.hooks';
import { MeController } from '../users/me.controller';
import { UsersService } from '../users/users.service';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { OtpService } from './otp.service';
import { PinService } from './pin.service';
import { SessionService } from './session.service';
import { StepUpService } from './step-up.service';
import { TokenService } from './token.service';

/**
 * Tourist identity: auth (OTP, sessions, PIN, step-up) and the /v1/me profile. Users and auth
 * depend on each other (sign-in creates users; deletion revokes sessions), so their providers are
 * registered in one module instead of two mutually importing modules.
 */
@Module({
  imports: [ConsentsModule],
  controllers: [AuthController, MeController],
  providers: [
    TokenService,
    SessionService,
    OtpService,
    PinService,
    StepUpService,
    AuthService,
    UsersService,
    AccountDeletionHooks,
    AuthGuard,
  ],
  exports: [
    TokenService,
    SessionService,
    StepUpService,
    PinService,
    AccountDeletionHooks,
    AuthGuard,
    UsersService,
  ],
})
export class AuthModule {}
